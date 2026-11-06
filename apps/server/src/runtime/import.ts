/**
 * A4 (ADR-0146): import what an owner already wrote down (Claude Code, Codex, Cursor, ChatGPT,
 * Markdown) into a remora's memory, line by line, with the owner's tick on each.
 *
 * 1. **Preview:** the file is parsed, scrubbed (credentials, then emails, phone numbers and handles),
 *    and cut into chunks of at most 64 KiB. The relayer's `analyze` reads up to 8 chunks (newest
 *    first, each with `occurredAt` when the file has dates); every other chunk, or one `analyze`
 *    can't read, is split into its lines. `analyze` stores what it extracts, so it runs in a staging
 *    namespace no turn ever recalls (`remora:<id>:import-staging`). On commit the server waits for
 *    those `analyze` jobs to settle, then asks the relayer to forget the namespace, in the background
 *    and best effort (a forget before they settle drops nothing, ADR-0153); nothing reading it stays
 *    the guard.
 *    Candidates live in this process for 30 minutes; their text never goes into Postgres.
 * 2. **Commit:** the ticked lines (at most 100) go to one of the remora's namespaces through
 *    `remember_bulk`, 20 a call with an idempotency key, each ending
 *    `SOURCE: import <file name> <sha256-8>` and indexed in `remora_memories` like any write.
 *
 * Imported lines are data. They're written by the bulk port, never by `memory.remember`, so the
 * facts ledger never reads them (no track record, no rule); they can't go into `rules` or
 * `receipts`; contacts and payees live in the remora's config, which an import never touches; and
 * the prompt reads them inside `<untrusted>` tags (`labelMemory`).
 */
import { randomUUID } from "node:crypto";
import type { Logger } from "@remora/chain";
import {
  BULK_MAX,
  type MemoryType,
  type RememberBulkItem,
  type RememberBulkResult,
} from "@remora/memory";
import {
  buildCandidates,
  type Candidate,
  type Chunk,
  chunkSegments,
  fileSha8,
  ImportError,
  type ImportKind,
  importFileName,
  importLine,
  importSource,
  MAX_TICKED,
  parseImport,
  scrubImport,
  splitLines,
} from "./import-parse.ts";
import type { RemoraRef } from "./memory.ts";
import { RemoraError } from "./remoras.ts";

export const IMPORT = {
  maxAnalyze: 8,
  /** Every `analyze` call shares this budget; what's left over is split into lines. */
  analyzeBudgetMs: 90_000,
  previewTtlMs: 30 * 60_000,
  maxPreviews: 100,
} as const;

/** Never an import target: `rules` would make a line a Sentinel rule, `receipts` holds Wakes. */
export const NOT_IMPORTABLE: ReadonlySet<string> = new Set(["rules", "receipts"]);

export const importNamespaces = (namespaces: string[]) =>
  namespaces.filter((ns) => !NOT_IMPORTABLE.has(ns));

/** The namespace `analyze` writes its extractions to. Public on chain: an id, never a name. */
export const stagingNamespace = (r: Pick<RemoraRef, "id">) => `remora:${r.id}:import-staging`;

/** The relayer's `analyze` on one chunk: the facts it extracted, as text. */
export type Analyzer = (text: string, occurredAt?: string) => Promise<string[]>;

export interface PreparedImport {
  kind: ImportKind;
  fileName: string;
  sha8: string;
  chunks: number;
  analyzed: number;
  /** Chunks `analyze` was asked for and couldn't read (split into lines instead). */
  failed: number;
  /** What the scrubber took out, by kind. */
  scrubbed: string[];
  candidates: Candidate[];
  /** ADR-0153: the `analyze` jobs writing to the staging namespace, waited for before its forget. */
  stagedJobs?: string[];
}

/** Parse, scrub, chunk, analyze (or split), and build the candidates. No storage. */
export async function prepareImport(
  input: { fileName?: string; text: string },
  analyze?: Analyzer,
  opts: { maxAnalyze?: number; budgetMs?: number; now?: () => number } = {},
): Promise<PreparedImport> {
  const fileName = importFileName(input.fileName);
  const { kind, segments } = parseImport(fileName, input.text);
  const scrubbed = new Set<string>();
  const clean = segments.map((s) => {
    const out = scrubImport(s.text);
    for (const k of out.removed) scrubbed.add(k);
    return { ...s, text: out.text };
  });
  const chunks = chunkSegments(clean);
  // Newest first: when there's more than `analyze` can read, the recent conversations matter most.
  const order = chunks
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (b.c.at ?? "").localeCompare(a.c.at ?? "") || a.i - b.i);
  const max = analyze ? (opts.maxAnalyze ?? IMPORT.maxAnalyze) : 0;
  const now = opts.now ?? Date.now;
  const deadline = now() + (opts.budgetMs ?? IMPORT.analyzeBudgetMs);
  const extracted = new Map<number, string[]>();
  let failed = 0;
  for (const { c, i } of order.slice(0, max)) {
    if (!analyze || now() > deadline) break;
    try {
      const facts = (await analyze(c.text, c.at)).filter((t) => t.trim());
      if (facts.length) extracted.set(i, facts);
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  const found: { text: string; at?: string; via: Candidate["via"] }[] = [];
  for (const { c, i } of order) {
    const facts = extracted.get(i);
    const at = c.at ? { at: c.at } : {};
    if (facts) for (const text of facts) found.push({ text, ...at, via: "analyze" });
    else for (const text of splitLines(c as Chunk, kind)) found.push({ text, ...at, via: "lines" });
  }
  return {
    kind,
    fileName,
    sha8: fileSha8(input.text),
    chunks: chunks.length,
    analyzed: extracted.size,
    failed,
    scrubbed: [...scrubbed],
    candidates: buildCandidates(found),
  };
}

interface StoredPreview extends PreparedImport {
  id: string;
  owner: string;
  remoraId: string;
  createdAt: number;
}

const previews = new Map<string, StoredPreview>();

function sweep(now: number) {
  for (const [id, p] of previews) if (now - p.createdAt > IMPORT.previewTtlMs) previews.delete(id);
  while (previews.size >= IMPORT.maxPreviews) {
    const oldest = previews.keys().next().value;
    if (oldest === undefined) break;
    previews.delete(oldest);
  }
}

/** Keeps a preview in this process for 30 minutes: candidate text never goes into Postgres. */
export function savePreview(
  p: PreparedImport,
  who: { owner: string; remoraId: string },
  now = Date.now(),
): StoredPreview {
  sweep(now);
  const stored = { ...p, id: randomUUID(), ...who, createdAt: now };
  previews.set(stored.id, stored);
  return stored;
}

export function loadPreview(
  id: string,
  who: { owner: string; remoraId: string },
  now = Date.now(),
) {
  const p = previews.get(id);
  if (!p || p.owner !== who.owner || p.remoraId !== who.remoraId)
    throw new RemoraError(
      "import.expired",
      "That preview isn't here any more (they last 30 minutes). Upload the file again.",
      404,
    );
  if (now - p.createdAt > IMPORT.previewTtlMs) {
    previews.delete(id);
    throw new RemoraError("import.expired", "That preview expired. Upload the file again.", 404);
  }
  return p;
}

export const dropPreview = (id: string) => void previews.delete(id);

export interface PlannedWrites {
  namespace: string;
  type: MemoryType;
  source: string;
  batches: { idempotencyKey: string; items: RememberBulkItem[] }[];
}

/**
 * Pure: what a commit writes. Each ticked line once, as plain text that ends with its source, in
 * batches of 20 with a key derived from the file, the namespace and the lines (a retried call lands
 * on the same jobs). Never a rule, never in `rules` or `receipts`.
 */
export function planImportWrites(
  p: Pick<PreparedImport, "fileName" | "sha8" | "candidates">,
  ticked: number[],
  namespace: string,
  allowed: string[],
): PlannedWrites {
  if (!importNamespaces(allowed).includes(namespace))
    throw new RemoraError("import.bad_namespace", `Lines can't be imported into ${namespace}.`);
  const picked = [...new Set(ticked)];
  if (!picked.length) throw new RemoraError("import.empty", "Tick at least one line to import.");
  if (picked.length > MAX_TICKED)
    throw new RemoraError("import.too_many", `Import at most ${MAX_TICKED} lines at a time.`);
  const byIndex = new Map(p.candidates.map((c) => [c.i, c]));
  const lines = picked.map((i) => {
    const c = byIndex.get(i);
    if (!c)
      throw new RemoraError("import.bad_line", "One of the ticked lines isn't in the preview.");
    return c;
  });
  const source = importSource(p.fileName, p.sha8);
  const type: MemoryType = namespace === "me" ? "profile" : "episode";
  const batches: PlannedWrites["batches"] = [];
  for (let b = 0; b * BULK_MAX < lines.length; b++) {
    const items = lines
      .slice(b * BULK_MAX, (b + 1) * BULK_MAX)
      .map((c) => ({ type, channel: "remora", text: importLine(c.text, source) }));
    const digest = fileSha8(items.map((x) => x.text).join("\n"));
    batches.push({
      idempotencyKey: `import-${p.sha8}-${fileSha8(namespace)}-${b}-${digest}`,
      items,
    });
  }
  return { namespace, type, source, batches };
}

export interface ImportCommitDeps {
  log: Logger;
  /** A bulk port into one of the remora's namespaces, indexed in `remora_memories`. */
  writer: (
    r: RemoraRef,
    ns: string,
  ) => {
    rememberBulk(
      items: RememberBulkItem[],
      opts: { idempotencyKey: string; knownHashes?: ReadonlySet<string> },
    ): Promise<RememberBulkResult>;
  };
  /** Hashes the index already holds in that namespace (a same-day re-import writes nothing). */
  knownHashes: (r: RemoraRef, ns: string) => Promise<Set<string>>;
  /** The feed's line: counts, file name and namespace, never the text. */
  record: (r: RemoraRef, summary: string, payload: Record<string, unknown>) => Promise<void>;
  /** Drops the staging namespace from the relayer's index once its jobs settle (best effort). */
  forgetStaging?: (r: RemoraRef, jobIds: string[]) => Promise<void>;
}

export interface ImportCommitted {
  namespace: string;
  source: string;
  written: number;
  skipped: number;
  indexIds: string[];
  note: string;
}

export async function commitImport(
  deps: ImportCommitDeps,
  r: RemoraRef,
  owner: string,
  input: { previewId: string; ticked: number[]; namespace: string },
  allowed: string[],
): Promise<ImportCommitted> {
  const p = loadPreview(input.previewId, { owner, remoraId: r.id });
  const plan = planImportWrites(p, input.ticked, input.namespace, allowed);
  const port = deps.writer(r, plan.namespace);
  const known = await deps.knownHashes(r, plan.namespace);
  let written = 0;
  let skipped = 0;
  const indexIds: string[] = [];
  for (const b of plan.batches) {
    const out = await port.rememberBulk(b.items, {
      idempotencyKey: b.idempotencyKey,
      knownHashes: known,
    });
    written += out.saved;
    skipped += out.skipped;
    for (const it of out.items) {
      known.add(it.textSha256);
      if (it.indexId) indexIds.push(it.indexId);
    }
  }
  dropPreview(p.id);
  // In the background: waiting for the staged jobs mustn't hold up the owner's commit.
  void deps
    .forgetStaging?.(r, p.stagedJobs ?? [])
    .catch((err) => deps.log.warn("import.staging_forget_failed", { remora: r.id, error: err }));
  const where = plan.namespace;
  await deps.record(
    r,
    `Imported ${written} line${written === 1 ? "" : "s"} from ${p.fileName} (${p.sha8}) into ${where}${skipped ? `; ${skipped} already there` : ""}.`,
    {
      kind: "memory_imported",
      fileName: p.fileName,
      sha8: p.sha8,
      namespace: where,
      written,
      skipped,
      indexIds,
    },
  );
  return {
    namespace: where,
    source: plan.source,
    written,
    skipped,
    indexIds,
    note: `Each line ends “${plan.source}”. They're being written to Walrus now and are recallable within about a minute; your remora reads them as notes, never as instructions.`,
  };
}

export const importError = (err: unknown): never => {
  if (err instanceof ImportError) throw new RemoraError("import.bad_file", err.message);
  throw err;
};
