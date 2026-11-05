/**
 * D2 (ADR-0149): ratings, the author's analytics and the badge.
 * - **A rating** is 1–5 stars and at most 280 characters from an owner who hatched the template here,
 *   signed as a personal message (no transaction). The message names the network, the template, the
 *   stars and the SHA-256 of the text as stored, so anyone can check a stored rating again.
 * - It's a `template.rated` event on the rater's hatched remora. One per address per template: the
 *   last one signed counts.
 * - **Weighted by real use:** a rating weighs 1 + log2(1 + paid calls of the rater's remoras hatched
 *   from it), at most 6. A free template's ratings all weigh 1.
 * - The text is scrubbed (credentials, emails, handles, phone numbers) and shown as text only.
 * - **The author** sees hatches, active remoras over 7 days, sales (U17) and the ratings; public
 *   pages show counts only.
 * - **The badge** (`/badge/:id.svg`) is a plain SVG with the name and the live hatch count.
 */
import { createHash } from "node:crypto";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import type { SuiNetwork } from "@remora/chain";
import {
  and,
  count,
  type Db,
  eq,
  gt,
  hatcheryForks,
  hatcheryTemplates,
  inArray,
  ne,
  or,
  remoraEvents,
  remoras,
  sql,
} from "@remora/db";
import { addressFromSignature, redactCredentials } from "@remora/memory";
import {
  RATING_TEXT_MAX,
  type RatingMessage,
  type RatingSaved,
  type TemplateAnalytics,
  type TemplateRating,
  type TemplateRatingSummary,
} from "@remora/schema";
import { z } from "zod";
import { RemoraError } from "../runtime/remoras.ts";
import type { HatcheryDeps } from "./service.ts";

export const RATED_EVENT = "template.rated";
/** A signed rating is accepted for this long after it was signed. */
export const SIGNED_WINDOW_MS = 10 * 60_000;
const MAX_WEIGHT = 6;
const DAY_MS = 86_400_000;

/** Every C0 control character and DEL replaced (tabs and newlines included). */
const withoutControls = (s: string, by: string) =>
  [...s].map((ch) => (ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f ? by : ch)).join("");

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

// ── The text ────────────────────────────────────────────────────────────────

/** Credentials, emails, handles and phone numbers out; one line; at most 280 characters. */
export function scrubRating(text: string): string {
  const flat = withoutControls(text, " ").replace(/\s+/g, " ").trim();
  return redactCredentials(flat)
    .text.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email removed]")
    .replace(/(^|[\s(,;:])@[A-Za-z0-9_]{2,}/g, "$1[handle removed]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, (m) =>
      m.replace(/\D/g, "").length >= 9 && !/\d\.\d/.test(m) ? "[phone removed]" : m,
    )
    .slice(0, RATING_TEXT_MAX);
}

/** What the wallet signs. Rebuilt on the server from the fields, never taken from the client. */
export function ratingMessage(p: {
  network: SuiNetwork | string;
  templateId: string;
  stars: number;
  text: string;
  at: string;
}): string {
  return [
    `Rate a Remora template (Sui ${p.network}).`,
    "",
    `Template: ${p.templateId}`,
    `Stars: ${p.stars} of 5`,
    `Text SHA-256: ${sha256(p.text)}`,
    `Signed at: ${p.at}`,
    "",
    "This signs nothing else: no transaction, no spending.",
  ].join("\n");
}

// ── Weighting ───────────────────────────────────────────────────────────────

export const ratingWeight = (paidCalls: number) =>
  Math.min(MAX_WEIGHT, 1 + Math.log2(1 + Math.max(0, paidCalls)));

export interface RatedEvent {
  templateId: string;
  rater: string;
  stars: number;
  text: string;
  /** When it was signed (from the message). */
  at: string;
  createdAt: Date;
}

/** One per address per template: the one signed last (then stored last) wins. */
export function latestPerRater<T extends RatedEvent>(events: T[]): T[] {
  const best = new Map<string, T>();
  for (const e of events) {
    const k = `${e.templateId}|${e.rater}`;
    const b = best.get(k);
    if (!b || e.at > b.at || (e.at === b.at && e.createdAt.getTime() >= b.createdAt.getTime()))
      best.set(k, e);
  }
  return [...best.values()];
}

/** The weighted average, one decimal; null with no ratings. */
export function weightedRating(
  list: { stars: number; weight: number }[],
): TemplateRatingSummary | null {
  const total = list.reduce((s, x) => s + x.weight, 0);
  if (!list.length || total <= 0) return null;
  const stars = list.reduce((s, x) => s + x.stars * x.weight, 0) / total;
  return { stars: Math.round(stars * 10) / 10, count: list.length };
}

const RatedPayload = z.object({
  templateId: z.string(),
  rater: z.string(),
  stars: z.number().int().min(1).max(5),
  text: z.string(),
  at: z.string(),
});

/** Every template's ratings, as its author sees them, newest first. */
export async function ratingsOf(
  db: Db,
  templateIds: string[],
): Promise<Map<string, TemplateRating[]>> {
  const out = new Map<string, TemplateRating[]>();
  if (!templateIds.length) return out;
  const forks = await db
    .select({
      templateId: hatcheryForks.templateId,
      by: hatcheryForks.by,
      ids: hatcheryForks.remoraIds,
    })
    .from(hatcheryForks)
    .where(inArray(hatcheryForks.templateId, templateIds));
  const remoraIds = [...new Set(forks.flatMap((f) => f.ids))];
  if (!remoraIds.length) return out;
  const rows = await db
    .select({
      remoraId: remoraEvents.remoraId,
      payload: remoraEvents.payload,
      createdAt: remoraEvents.createdAt,
    })
    .from(remoraEvents)
    .where(and(inArray(remoraEvents.remoraId, remoraIds), eq(remoraEvents.type, RATED_EVENT)));
  const events = rows.flatMap((row) => {
    const p = RatedPayload.safeParse(row.payload);
    // Only a rating on a remora its rater hatched from that very template counts.
    if (
      !p.success ||
      !forks.some(
        (f) =>
          f.templateId === p.data.templateId &&
          f.by === p.data.rater &&
          f.ids.includes(row.remoraId),
      )
    )
      return [];
    return [{ ...p.data, createdAt: row.createdAt }];
  });
  const latest = latestPerRater(events);
  if (!latest.length) return out;
  const paid = await db
    .select({ remoraId: remoraEvents.remoraId, n: count() })
    .from(remoraEvents)
    .where(and(inArray(remoraEvents.remoraId, remoraIds), eq(remoraEvents.type, "payment")))
    .groupBy(remoraEvents.remoraId);
  const callsOf = (id: string) => Number(paid.find((x) => x.remoraId === id)?.n ?? 0);
  for (const e of latest.sort((a, b) => (a.at < b.at ? 1 : -1))) {
    const theirs = new Set(
      forks.filter((f) => f.templateId === e.templateId && f.by === e.rater).flatMap((f) => f.ids),
    );
    const paidCalls = [...theirs].reduce((s, id) => s + callsOf(id), 0);
    const list = out.get(e.templateId) ?? [];
    list.push({
      rater: e.rater,
      stars: e.stars,
      text: e.text,
      paidCalls,
      weight: Math.round(ratingWeight(paidCalls) * 100) / 100,
      at: e.at,
    });
    out.set(e.templateId, list);
  }
  return out;
}

/** The gallery's numbers: the weighted rating per template, counts only. */
export async function ratingSummaries(db: Db, templateIds: string[]) {
  const all = await ratingsOf(db, templateIds);
  return new Map([...all.entries()].map(([id, list]) => [id, weightedRating(list)] as const));
}

// ── Rating ──────────────────────────────────────────────────────────────────

async function templateRow(db: Db, templateId: string) {
  const [row] = await db
    .select()
    .from(hatcheryTemplates)
    .where(eq(hatcheryTemplates.templateId, normalizeSuiAddress(templateId)));
  if (!row) throw new RemoraError("hatchery.not_found", "No template with that id here.", 404);
  return row;
}

function checkInput(stars: unknown, text: unknown) {
  if (typeof stars !== "number" || !Number.isInteger(stars) || stars < 1 || stars > 5)
    throw new RemoraError("rating.bad_stars", "Give it 1 to 5 stars.");
  if (typeof text !== "string" || text.length > RATING_TEXT_MAX)
    throw new RemoraError("rating.too_long", `Say it in ${RATING_TEXT_MAX} characters or fewer.`);
  return { stars, text: scrubRating(text) };
}

/** Step 1: the text as it will be stored, and the message to sign over it. */
export async function ratingToSign(
  h: Pick<HatcheryDeps, "runtime">,
  templateId: string,
  input: { stars?: unknown; text?: unknown },
  now = new Date(),
): Promise<RatingMessage> {
  const row = await templateRow(h.runtime.db, templateId);
  const { stars, text } = checkInput(input.stars, input.text ?? "");
  const at = now.toISOString();
  return {
    message: ratingMessage({ network: row.network, templateId: row.templateId, stars, text, at }),
    text,
    at,
  };
}

/** The rater's own remora hatched from this template here, or null. */
async function raterRemora(db: Db, templateId: string, rater: string) {
  const forks = await db
    .select({ ids: hatcheryForks.remoraIds })
    .from(hatcheryForks)
    .where(and(eq(hatcheryForks.templateId, templateId), eq(hatcheryForks.by, rater)));
  const ids = [...new Set(forks.flatMap((f) => f.ids))];
  if (!ids.length) return null;
  const [r] = await db
    .select()
    .from(remoras)
    .where(
      and(inArray(remoras.id, ids), eq(remoras.ownerAddress, rater), eq(remoras.playground, false)),
    )
    .orderBy(remoras.createdAt)
    .limit(1);
  return r ?? null;
}

/** Step 2: the signed rating, checked and stored. */
export async function rateTemplate(
  h: Pick<HatcheryDeps, "runtime">,
  templateId: string,
  input: { stars?: unknown; text?: unknown; at?: unknown; signature?: unknown },
  now = Date.now(),
): Promise<RatingSaved> {
  const db = h.runtime.db;
  const row = await templateRow(db, templateId);
  const { stars, text } = checkInput(input.stars, input.text ?? "");
  const at = typeof input.at === "string" ? input.at : "";
  const signedAt = Date.parse(at);
  if (Number.isNaN(signedAt) || new Date(signedAt).toISOString() !== at)
    throw new RemoraError("rating.bad_time", "Sign the rating again.");
  if (signedAt > now + 60_000 || now - signedAt > SIGNED_WINDOW_MS)
    throw new RemoraError("rating.expired", "That signature is too old. Sign the rating again.");
  if (typeof input.signature !== "string" || !input.signature)
    throw new RemoraError("rating.bad_signature", "Sign the rating with your wallet.");
  const message = ratingMessage({
    network: row.network,
    templateId: row.templateId,
    stars,
    text,
    at,
  });
  const signer = await addressFromSignature(
    message,
    input.signature,
    h.runtime.networks.client(row.network as SuiNetwork),
  );
  if (!signer)
    throw new RemoraError(
      "rating.bad_signature",
      "That signature isn't over this rating. Sign it again.",
    );
  const rater = normalizeSuiAddress(signer);
  const r = await raterRemora(db, row.templateId, rater);
  if (!r)
    throw new RemoraError(
      "rating.not_hatched",
      "Only an owner who made a copy of this template here can rate it.",
      403,
    );
  // The same signature twice is one rating.
  const [dup] = await db
    .select({ id: remoraEvents.id })
    .from(remoraEvents)
    .where(
      and(
        eq(remoraEvents.remoraId, r.id),
        eq(remoraEvents.type, RATED_EVENT),
        sql`${remoraEvents.payload}->>'signature' = ${input.signature}`,
      ),
    )
    .limit(1);
  if (!dup)
    await db.insert(remoraEvents).values({
      remoraId: r.id,
      network: r.network,
      type: RATED_EVENT,
      summary: `Rated ${row.name ?? "its template"} ${stars} of 5.`,
      payload: {
        templateId: row.templateId,
        rater,
        stars,
        text,
        textSha256: sha256(text),
        at,
        message,
        signature: input.signature,
      },
    });
  const summary = (await ratingSummaries(db, [row.templateId])).get(row.templateId) ?? null;
  return { rating: summary, mine: { stars, text, at } };
}

/** Whether this owner can rate the template, and the rating they gave, if any. */
export async function myRating(db: Db, templateId: string, owner: string) {
  const row = await templateRow(db, templateId);
  const me = normalizeSuiAddress(owner);
  const r = await raterRemora(db, row.templateId, me);
  const mine = (await ratingsOf(db, [row.templateId]))
    .get(row.templateId)
    ?.find((x) => x.rater === me);
  return {
    canRate: !!r,
    mine: mine ? { stars: mine.stars, text: mine.text, at: mine.at } : null,
  };
}

// ── The author's view ───────────────────────────────────────────────────────

export async function templateAnalytics(
  db: Db,
  owner: string,
  templateId: string,
  now = Date.now(),
): Promise<TemplateAnalytics> {
  const row = await templateRow(db, templateId);
  if (row.author !== normalizeSuiAddress(owner))
    throw new RemoraError("hatchery.not_author", "Only its author sees its numbers.", 403);
  const forks = await db
    .select({ ids: hatcheryForks.remoraIds })
    .from(hatcheryForks)
    .where(eq(hatcheryForks.templateId, row.templateId));
  const ids = [...new Set(forks.flatMap((f) => f.ids))];
  const live = ids.length
    ? await db
        .select({ id: remoras.id })
        .from(remoras)
        .where(and(inArray(remoras.id, ids), ne(remoras.status, "retired")))
    : [];
  const liveIds = live.map((x) => x.id);
  const active = liveIds.length
    ? await db
        .selectDistinct({ id: remoraEvents.remoraId })
        .from(remoraEvents)
        .where(
          and(
            inArray(remoraEvents.remoraId, liveIds),
            gt(remoraEvents.createdAt, new Date(now - 7 * DAY_MS)),
            inArray(remoraEvents.type, ["answer", "payment", "ping", "shadow", "episode"]),
          ),
        )
    : [];
  const [sold] = ids.length
    ? await db
        .select({
          n: count(),
          sum: sql<string>`coalesce(sum((${remoraEvents.payload}->>'amount')::numeric), 0)`,
        })
        .from(remoraEvents)
        .where(
          and(
            inArray(remoraEvents.remoraId, ids),
            eq(remoraEvents.type, "action"),
            sql`${remoraEvents.payload}->>'kind' = 'sale'`,
          ),
        )
    : [];
  const ratings = (await ratingsOf(db, [row.templateId])).get(row.templateId) ?? [];
  return {
    templateId: row.templateId,
    hatches: forks.length,
    remoras: ids.length,
    active7d: active.length,
    sales: Number(sold?.n ?? 0),
    salesRevenue: BigInt(String(sold?.sum ?? "0").split(".")[0] || "0").toString(),
    rating: weightedRating(ratings),
    ratings,
  };
}

// ── The badge ───────────────────────────────────────────────────────────────

const XML: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
/** Control characters aren't valid XML; `&<>"'` become entities. */
export const escapeXml = (s: string) =>
  withoutControls(s, "").replace(/[&<>"']/g, (c) => XML[c] ?? c);

/** Rough Verdana 11px widths, so the boxes fit their text without a font on the server. */
const widthOf = (s: string) =>
  Math.round(
    [...s].reduce(
      (w, ch) => w + (/[ilj.,:;'|!]/.test(ch) ? 3.6 : /[mwMW@]/.test(ch) ? 9.5 : 6.9),
      0,
    ) + 12,
  );

/**
 * A shields-style badge: "remora" | "<name> · N hatches" (null: "template not found"). Text is
 * escaped; no scripts, no links.
 */
export function badgeSvg(name: string, hatches: number | null): string {
  const clean = name.replace(/\s+/g, " ").trim() || "template";
  const short = [...clean].length > 36 ? `${[...clean].slice(0, 35).join("")}…` : clean;
  const right =
    hatches === null
      ? "template not found"
      : `${short} · ${hatches} ${hatches === 1 ? "hatch" : "hatches"}`;
  const left = "remora";
  const lw = widthOf(left);
  const rw = widthOf(right);
  const w = lw + rw;
  const label = escapeXml(`${left}: ${right}`);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${label}">`,
    `<title>${label}</title>`,
    `<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>`,
    `<clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>`,
    `<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#3b3f46"/><rect x="${lw}" width="${rw}" height="20" fill="#0f766e"/><rect width="${w}" height="20" fill="url(#s)"/></g>`,
    `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">`,
    `<text x="${lw / 2}" y="14">${escapeXml(left)}</text>`,
    `<text x="${lw + rw / 2}" y="14">${escapeXml(right)}</text>`,
    "</g></svg>",
  ].join("");
}

const BASE58_DIGEST = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const OBJECT_ID = /^0x[0-9a-fA-F]{1,64}$/;

/** A minute's memo, so a badge hot-linked from a busy README doesn't hit the database each view. */
const memo = new Map<string, { at: number; svg: string; found: boolean }>();

/** The badge for a template id or its publish digest; a "not found" badge (and false) otherwise. */
export async function badgeFor(
  db: Db,
  key: string,
  now = Date.now(),
): Promise<{ svg: string; found: boolean }> {
  const hit = memo.get(key);
  if (hit && now - hit.at < 60_000) return hit;
  const where = OBJECT_ID.test(key)
    ? eq(hatcheryTemplates.templateId, normalizeSuiAddress(key))
    : BASE58_DIGEST.test(key)
      ? or(eq(hatcheryTemplates.publishDigest, key), eq(hatcheryTemplates.templateId, key))
      : null;
  const [row] = where
    ? await db
        .select({ id: hatcheryTemplates.templateId, name: hatcheryTemplates.name })
        .from(hatcheryTemplates)
        .where(where)
        .limit(1)
    : [];
  let out: { svg: string; found: boolean };
  if (!row) out = { svg: badgeSvg("", null), found: false };
  else {
    const [n] = await db
      .select({ n: count() })
      .from(hatcheryForks)
      .where(eq(hatcheryForks.templateId, row.id));
    out = { svg: badgeSvg(row.name ?? "template", Number(n?.n ?? 0)), found: true };
  }
  memo.set(key, { at: now, ...out });
  if (memo.size > 500) memo.delete(memo.keys().next().value as string);
  return out;
}
