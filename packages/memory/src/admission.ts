/**
 * F15 (ADR-0074): memory admission. Recall answers "what is similar to the question"; admission
 * answers "what should the model read". Similar isn't useful: a superseded track record, the same
 * line stored twice, or ten loosely related lines are noise the model has to argue with.
 *
 * `admit` is deterministic: rank by distance, drop repeats, drop what the fact ledger says is no
 * longer true, then cap per namespace, in total and by a token budget. `judge` is an optional second
 * pass by a model that can only drop candidates, and fails open: on a timeout, an error, a malformed
 * answer or low confidence, the deterministic set stands. Losing a memory that mattered costs more
 * than reading a few extra tokens.
 */
import { parseMemoryText } from "./format.ts";

export interface AdmissionCandidate {
  blobId: string;
  namespace: string;
  text: string;
  distance: number;
}

export type RejectReason =
  | "duplicate"
  | "superseded"
  | "disputed"
  | "over_namespace_cap"
  | "over_candidate_cap"
  | "over_budget"
  | "not_useful";

export interface Rejected {
  blobId: string;
  namespace: string;
  reason: RejectReason;
}

export interface AdmissionPolicy {
  maxCandidates: number;
  perNamespace: number;
  /** Tokens of memory text the model reads, estimated at four characters a token. */
  tokenBudget: number;
}

export const ADMISSION_DEFAULTS: AdmissionPolicy = {
  maxCandidates: 10,
  perNamespace: 8,
  tokenBudget: 600,
};

/** What the fact ledger knows about a recalled blob: every fact it asserted is no longer true. */
export type Staleness = "superseded" | "disputed";

export interface Admission<T extends AdmissionCandidate> {
  admitted: T[];
  rejected: Rejected[];
}

export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

/** The fact itself, without our tags or the case and spacing it was typed with. */
const body = (text: string) =>
  (parseMemoryText(text)?.text ?? text)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!\s]+$/, "")
    .trim();

export function admit<T extends AdmissionCandidate>(
  candidates: readonly T[],
  stale: ReadonlyMap<string, Staleness> = new Map(),
  policy: AdmissionPolicy = ADMISSION_DEFAULTS,
): Admission<T> {
  const ranked = [...candidates].sort(
    (a, b) => a.distance - b.distance || a.blobId.localeCompare(b.blobId),
  );
  const admitted: T[] = [];
  const rejected: Rejected[] = [];
  const seen = new Set<string>();
  const perNs = new Map<string, number>();
  let tokens = 0;
  const reject = (c: T, reason: RejectReason) =>
    rejected.push({ blobId: c.blobId, namespace: c.namespace, reason });
  for (const c of ranked) {
    const why = stale.get(c.blobId);
    if (why) {
      reject(c, why);
      continue;
    }
    const key = body(c.text);
    if (seen.has(key)) {
      reject(c, "duplicate");
      continue;
    }
    seen.add(key);
    if (admitted.length >= policy.maxCandidates) {
      reject(c, "over_candidate_cap");
      continue;
    }
    if ((perNs.get(c.namespace) ?? 0) >= policy.perNamespace) {
      reject(c, "over_namespace_cap");
      continue;
    }
    const cost = estimateTokens(c.text);
    if (tokens + cost > policy.tokenBudget) {
      reject(c, "over_budget");
      continue;
    }
    tokens += cost;
    perNs.set(c.namespace, (perNs.get(c.namespace) ?? 0) + 1);
    admitted.push(c);
  }
  return { admitted, rejected };
}

/** A model's read of which candidates help answer the question. It may keep none. */
export type UsefulnessJudge = (input: {
  question: string;
  candidates: { id: string; text: string }[];
}) => Promise<{ keep: string[]; confidence: number }>;

export type JudgeOutcome = "kept_all" | "filtered" | "failed_open" | "skipped";

export const JUDGE_TIMEOUT_MS = 1_500;
export const JUDGE_MIN_CONFIDENCE = 0.6;

/** The optional second pass. It only drops; anything it can't vouch for leaves the set as it was. */
export async function judgeAdmitted<T extends AdmissionCandidate>(
  question: string,
  a: Admission<T>,
  judge: UsefulnessJudge | undefined,
  opts: { timeoutMs?: number; minConfidence?: number } = {},
): Promise<Admission<T> & { judged: JudgeOutcome }> {
  if (!judge || !a.admitted.length) return { ...a, judged: "skipped" };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const verdict = await Promise.race([
      judge({
        question,
        candidates: a.admitted.map((c) => ({ id: c.blobId, text: c.text })),
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("judge timed out")),
          opts.timeoutMs ?? JUDGE_TIMEOUT_MS,
        );
      }),
    ]);
    const ids = new Set(a.admitted.map((c) => c.blobId));
    const wellFormed =
      Array.isArray(verdict.keep) &&
      verdict.keep.every((id) => ids.has(id)) &&
      verdict.confidence >= (opts.minConfidence ?? JUDGE_MIN_CONFIDENCE);
    if (!wellFormed) return { ...a, judged: "failed_open" };
    const keep = new Set(verdict.keep);
    if (keep.size === ids.size) return { ...a, judged: "kept_all" };
    return {
      admitted: a.admitted.filter((c) => keep.has(c.blobId)),
      rejected: [
        ...a.rejected,
        ...a.admitted
          .filter((c) => !keep.has(c.blobId))
          .map((c) => ({
            blobId: c.blobId,
            namespace: c.namespace,
            reason: "not_useful" as const,
          })),
      ],
      judged: "filtered",
    };
  } catch {
    return { ...a, judged: "failed_open" };
  } finally {
    clearTimeout(timer);
  }
}
