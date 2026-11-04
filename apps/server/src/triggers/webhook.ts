/**
 * D1 webhook trigger (ADR-0121): `POST /api/hooks/:remoraId/:id`, signed with HMAC-SHA256 of the raw
 * body. The secret is derived from the server's secret and `remoraId:id` and never stored, so a new
 * `id` is a new secret. GitHub signs the same way in `X-Hub-Signature-256`, so a GitHub webhook works
 * as it is. The body reaches the turn only as untrusted data (ADR-0110).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { UntrustedData } from "../runtime/brain.ts";

export const HOOK_MAX_BYTES = 64 * 1024;
/** Per hook, after the signature checks out. */
export const HOOK_RATE = { limit: 30, ms: 60_000 };
export const HOOK_ID = /^[A-Za-z0-9_-]{8,64}$/;
/** `name` says who sends it ("github"); it changes the question, never the trust. */
export const HOOK_NAME = /^[a-z0-9-]{1,20}$/;

export function inboundSecret(serverSecret: string, remoraId: string, id: string): string {
  return createHmac("sha256", serverSecret)
    .update(`remora.hook.in:${remoraId}:${id}`)
    .digest("hex");
}

/** `sha256=<hex>` over the exact bytes received, compared in constant time. */
export function signatureOk(
  secret: string,
  body: Uint8Array | string,
  header: string | null | undefined,
): boolean {
  const m = /^sha256=([0-9a-f]{64})$/i.exec(header?.trim() ?? "");
  if (!m?.[1]) return false;
  const want = createHmac("sha256", secret).update(body).digest();
  const got = Buffer.from(m[1], "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

const GITHUB_REPO = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/;
const EVENT = /^[a-z_]{1,40}$/;
/** GitHub payloads are mostly API links; without them the part a model can use fits the prompt. */
const NOISE = /(^|_)url$|^node_id$|^gravatar_id$/;

/** The JSON a form-encoded GitHub delivery carries in `payload`, else the body as sent. */
function payloadOf(body: string, contentType: string | undefined): string {
  if (!contentType?.includes("application/x-www-form-urlencoded")) return body;
  return new URLSearchParams(body).get("payload") ?? body;
}

/**
 * What a delivery asks the remora. The question is ours; only a GitHub repository link that matches
 * `GITHUB_REPO` exactly is lifted from the body, so a Repo Reviewer checks the repo it was told about.
 * Everything else the sender wrote is data.
 */
export function hookTurn(o: {
  hookId: string;
  name?: string;
  event?: string;
  body: string;
  contentType?: string;
}): { question: string; data: UntrustedData } {
  const event = o.event && EVENT.test(o.event) ? o.event : undefined;
  const raw = payloadOf(o.body, o.contentType);
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const repo = (parsed as { repository?: { html_url?: unknown } } | null)?.repository?.html_url;
  const github = typeof repo === "string" && GITHUB_REPO.test(repo) ? repo : undefined;
  const from = o.name ?? o.hookId.slice(0, 8);
  const question = github
    ? `GitHub sent ${event ? `"${event}"` : "an event"} for ${github}. Tell me briefly what changed and whether I need to do anything.`
    : `A webhook${o.name ? ` from ${o.name}` : ""}${event ? ` ("${event}")` : ""} arrived. Tell me briefly what it says and whether I need to do anything.`;
  const content =
    parsed !== null && typeof parsed === "object"
      ? JSON.stringify(parsed, (k, v) => (NOISE.test(k) ? undefined : v))
      : raw;
  return {
    question,
    data: { source: `webhook ${from}${event ? ` (${event})` : ""}`, content },
  };
}
