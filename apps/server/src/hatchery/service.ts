/**
 * The Hatchery (M1, M3, M4, M5, M7; ADR-0012, ADR-0046, ADR-0047, ADR-0048).
 * - **share:** one remora exported as a team of one, scrubbed, reviewed: exactly what would leave.
 * - **publish:** the file goes to Walrus, then ONE owner transaction calls `hatchery::publish`.
 * - **gallery:** templates from our confirmations and the checkpoint indexer, with fork counts.
 * - **hatch:** the blob is read back, reviewed again, shown as a consent screen, then created through
 *   the team import with every Disc issue AND `hatchery::fork` in ONE owner transaction. Hatched
 *   remoras start in shadow mode; Disc limits always apply.
 */

import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import type { SuiNetwork } from "@remora/chain";
import {
  and,
  count,
  desc,
  eq,
  hatcheryForks,
  hatcheryTemplates,
  inArray,
  remoraEvents,
  sql,
} from "@remora/db";
import {
  type HatchConsent,
  type HatcheryListing,
  type SafetyReport,
  type ShareReview,
  TeamFile,
  type TemplatePermissions,
} from "@remora/schema";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { RuntimeDeps } from "../runtime/deps.ts";
import { type Remora, RemoraError, type RemoraService } from "../runtime/remoras.ts";
import { applyTeam, confirmTeam, exportTeam, parseTeamMarkdown } from "../runtime/teams.ts";
import { answersQuestions, TEMPLATES } from "../templates/index.ts";
import { decodeHatcheryEvents, type HatcheryEvent } from "./events.ts";
import { privateReason, reviewTemplate } from "./safety.ts";
import type { WalrusStore } from "./walrus.ts";

export interface HatcheryDeps {
  runtime: RuntimeDeps;
  service: RemoraService;
  walrus: WalrusStore;
  webBase: string;
  /** The Telegram bot's username, for `t.me/<bot>?start=tpl_<id>` links. */
  telegramBot?: string | null;
  /** Retries while Tatum catches up with the wallet's fullnode (tests set 1). */
  txReadAttempts?: number;
}

const usdText = (n: number) => (n < 0.1 ? n.toFixed(3).replace(/0$/, "") : n.toFixed(2));
const kindOf = (slug: string) => TEMPLATES[slug as keyof typeof TEMPLATES];

/** What each remora in a team file may do. */
export function permissionsOf(team: TeamFile): TemplatePermissions[] {
  return team.remoras.map((r) => {
    const kind = kindOf(r.template);
    const paying = !!kind?.payees.length;
    const b = paying ? (r.budget ?? { monthlyUsd: 1, perPaymentUsd: 0.05 }) : null;
    return {
      remora: r.name,
      template: r.template,
      tools: [...(kind?.tools ?? [])],
      triggers: [
        ...new Set([
          ...(kind?.triggers ?? []).map((t) => t.kind),
          ...(r.schedules.length && r.template === "scout" ? ["cron"] : []),
          ...(r.template === "briefer" && r.items.length ? ["cron"] : []),
        ]),
      ],
      payees: [...(kind?.payees ?? [])],
      budget: b
        ? `${usdText(b.monthlyUsd)} USDC a month, at most ${usdText(b.perPaymentUsd)} a payment`
        : null,
      model: r.model ?? null,
    };
  });
}

function hatcheryIds(h: HatcheryDeps, network: SuiNetwork) {
  const cfg = h.runtime.networks.config(network);
  if (!cfg.hatcheryPackageId || !cfg.hatcheryRegistryId)
    throw new RemoraError(
      "hatchery.unavailable",
      `Templates aren't published on ${network} yet.`,
      409,
    );
  return { pkg: cfg.hatcheryPackageId, registry: cfg.hatcheryRegistryId };
}

async function review(h: HatcheryDeps, network: SuiNetwork, team: TeamFile, markdown: string) {
  const brain = h.runtime.brain;
  return reviewTemplate({
    team,
    markdown,
    reef: h.runtime.reef(network).map((e) => e.ref),
    ...(brain.review
      ? { model: (text: string) => brain.review?.(text) ?? Promise.resolve(null) }
      : {}),
  });
}

/** Reads a transaction the owner just executed, waiting for Tatum to see it. */
async function readTx(h: HatcheryDeps, network: SuiNetwork, digest: string, owner: string) {
  const client: SuiGrpcClient = h.runtime.networks.client(network);
  const read = () =>
    client.core.getTransaction({
      digest,
      include: { effects: true, events: true, transaction: true },
    });
  let res: Awaited<ReturnType<typeof read>> | undefined;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await read();
      break;
    } catch (err) {
      if (
        attempt >= (h.txReadAttempts ?? 12) - 1 ||
        !/not found/i.test(String((err as Error).message))
      )
        throw err;
      await new Promise((ok) => setTimeout(ok, 1_500));
    }
  }
  const tx = res.Transaction ?? res.FailedTransaction;
  if (!tx.effects?.status.success)
    throw new RemoraError("tx.failed", "That transaction failed onchain.");
  const sender = tx.transaction?.sender ? normalizeSuiAddress(tx.transaction.sender) : "";
  if (sender !== normalizeSuiAddress(owner))
    throw new RemoraError("tx.not_owner", "That transaction wasn't sent by you.", 403);
  return tx;
}

// ── M1: share ────────────────────────────────────────────────────────────────

/** ADR-0131: the memories an author could add as a public starter pack, each checked. */
async function packCandidates(h: HatcheryDeps, r: Remora) {
  const ns = answersQuestions(r.template) ? ["sources", "feedback"] : ["rules"];
  const hits = await h.runtime.memory
    .recall(r, answersQuestions(r.template) ? "SOURCE score useful" : "RULE ignore", ns, 10)
    .catch(() => []);
  const seen = new Set<string>();
  return hits.flatMap((m) => {
    // The stored line carries hippo's tags (`[source] [by:…] [2026-11-05]`); the pack keeps the text.
    const text = m.text
      .replace(/^\s*(?:\[[^\]]*\]\s*)+/, "")
      .trim()
      .slice(0, 240);
    if (text.length < 3 || seen.has(text)) return [];
    seen.add(text);
    const why = privateReason(text);
    return [{ text, ok: !why, why }];
  });
}

export async function shareReview(
  h: HatcheryDeps,
  owner: string,
  remoraId: string,
  opts: { pack?: string[] } = {},
): Promise<ShareReview> {
  const r = await h.service.get(remoraId, owner);
  if (r.status === "creating" || r.status === "retired")
    throw new RemoraError(
      "hatchery.not_shareable",
      `${r.name} can't be shared while it's ${r.status}.`,
    );
  const kind = kindOf(r.template);
  const exported = await exportTeam(h.runtime, owner, r.network, {
    ids: [r.id],
    name: r.name,
    description: kind?.summary ?? `A ${r.template} remora.`,
  });
  const candidates = await packCandidates(h, r);
  // Only lines the author picked from what passed the check go into the public file.
  const pack = [...new Set(opts.pack ?? [])].filter((t) =>
    candidates.some((c) => c.ok && c.text === t),
  );
  const markdown = pack.length ? withPack(exported, pack.slice(0, 20)) : exported;
  const { team } = parseTeamMarkdown(markdown);
  const config = r.config as { triggers?: { kind: string; addresses?: string[] }[] };
  const watched = (config.triggers ?? []).flatMap((t) => t.addresses ?? []).length;
  const removed = [
    {
      field: "memories",
      reason: pack.length
        ? `Only the ${pack.length} starter memories you picked go along, in public plaintext; the rest stay yours.`
        : "Templates carry no memories unless you pick starter ones below; the hatcher's remora starts fresh.",
    },
    { field: "keys", reason: "The remora's key and its memory delegate stay with you." },
    {
      field: "disc",
      reason: "Spending limit ids stay with you; whoever copies it sets their own budget.",
    },
    { field: "wakes", reason: "Receipts and history stay with you." },
    ...(watched
      ? [
          {
            field: "watch",
            reason: `The ${watched} address(es) it watches stay private; a Wallet watcher made from it watches its new owner.`,
          },
        ]
      : []),
  ];
  return {
    team,
    markdown,
    permissions: permissionsOf(team),
    removed,
    safety: await review(h, r.network, team, markdown),
    sizeBytes: Buffer.byteLength(markdown, "utf8"),
    packCandidates: candidates,
  };
}

/** Puts a starter pack into a team file's frontmatter. */
function withPack(markdown: string, pack: string[]) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(markdown);
  if (!m) return markdown;
  const front = parseYaml(m[1] ?? "") as Record<string, unknown>;
  return `---\n${stringifyYaml({ ...front, pack }).trimEnd()}\n---\n${m[2] ?? ""}`;
}

// ── M3: publish ──────────────────────────────────────────────────────────────

/** Recently stored files by blob id, so confirm doesn't wait on the aggregator. */
const stored = new Map<string, string>();
const remember = (blobId: string, markdown: string) => {
  stored.set(blobId, markdown);
  if (stored.size > 200) stored.delete(stored.keys().next().value as string);
};

export async function publishTx(
  h: HatcheryDeps,
  owner: string,
  network: SuiNetwork,
  input: { markdown: string; parent?: string | null },
) {
  const { pkg, registry } = hatcheryIds(h, network);
  const { team } = parseTeamMarkdown(input.markdown);
  const safety = await review(h, network, team, input.markdown);
  if (safety.verdict === "block")
    throw new RemoraError(
      "hatchery.blocked",
      `This can't be published: ${safety.findings.find((f) => f.severity === "block")?.detail ?? "it failed the safety review."}`,
      409,
    );
  const { blobId } = await h.walrus.put(network, input.markdown);
  remember(blobId, input.markdown);
  const tx = new Transaction();
  if (input.parent)
    tx.moveCall({
      target: `${pkg}::hatchery::publish_derived`,
      arguments: [tx.object(registry), tx.object(input.parent), tx.pure.string(blobId)],
    });
  else
    tx.moveCall({
      target: `${pkg}::hatchery::publish`,
      arguments: [tx.object(registry), tx.pure.string(blobId)],
    });
  tx.setSender(normalizeSuiAddress(owner));
  return { transaction: await tx.toJSON(), blobId, safety };
}

/** Records (or refreshes) a template row from its blob: parsed, reviewed, ready for the gallery. */
async function ingest(
  h: HatcheryDeps,
  network: SuiNetwork,
  e: Extract<HatcheryEvent, { type: "Published" }>,
  publishDigest: string,
  markdown?: string,
) {
  await h.runtime.db
    .insert(hatcheryTemplates)
    .values({
      templateId: e.template,
      network,
      blobId: e.blobId,
      author: e.author,
      parent: e.parent,
      publishDigest,
    })
    .onConflictDoNothing();
  const text = markdown ?? stored.get(e.blobId) ?? (await h.walrus.get(network, e.blobId));
  let team: TeamFile | null = null;
  let safety: SafetyReport | null = null;
  try {
    team = parseTeamMarkdown(text).team;
    safety = await review(h, network, team, text);
  } catch (err) {
    safety = {
      verdict: "block",
      findings: [
        {
          severity: "block",
          code: "unknown_template",
          where: "file",
          detail: `Not a readable team file: ${(err as Error).message}`.slice(0, 200),
        },
      ],
      checks: ["patterns"],
      checkedAt: new Date().toISOString(),
    };
  }
  await h.runtime.db
    .update(hatcheryTemplates)
    .set({
      name: team?.name ?? "Unreadable template",
      description: team?.description ?? null,
      markdown: text,
      team: team as unknown as Record<string, unknown> | null,
      safety: safety as unknown as Record<string, unknown>,
      verdict: safety.verdict,
    })
    .where(eq(hatcheryTemplates.templateId, e.template));
}

export async function confirmPublish(
  h: HatcheryDeps,
  owner: string,
  network: SuiNetwork,
  digest: string,
) {
  const { pkg } = hatcheryIds(h, network);
  const tx = await readTx(h, network, digest, owner);
  const published = decodeHatcheryEvents(pkg, tx.events).find(
    (e): e is Extract<HatcheryEvent, { type: "Published" }> => e.type === "Published",
  );
  if (!published || published.author !== normalizeSuiAddress(owner))
    throw new RemoraError("hatchery.no_publish", "That transaction didn't publish a template.");
  await ingest(h, network, published, digest);
  return listing(h, network, published.template);
}

// ── M4: gallery ──────────────────────────────────────────────────────────────

type Row = typeof hatcheryTemplates.$inferSelect;

async function toListings(h: HatcheryDeps, rows: Row[]): Promise<HatcheryListing[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.templateId);
  const forks = await h.runtime.db
    .select({ templateId: hatcheryForks.templateId, n: count() })
    .from(hatcheryForks)
    .where(inArray(hatcheryForks.templateId, ids))
    .groupBy(hatcheryForks.templateId);
  const hatched = await h.runtime.db
    .select()
    .from(hatcheryForks)
    .where(inArray(hatcheryForks.templateId, ids));
  const remoraIds = hatched.flatMap((f) => f.remoraIds);
  // Opt-in outcomes: answers marked useful by the people who hatched, and what their remoras paid.
  const outcomes = remoraIds.length
    ? await h.runtime.db
        .select({
          remoraId: remoraEvents.remoraId,
          useful: sql<number>`count(*) filter (where ${remoraEvents.type} = 'answer' and ${remoraEvents.feedback} = 'useful')`,
          spent: sql<string>`coalesce(sum((${remoraEvents.payload}->>'amount')::numeric) filter (where ${remoraEvents.type} = 'payment' and ${remoraEvents.payload}->>'approvedBy' is null), 0)`,
        })
        .from(remoraEvents)
        .where(inArray(remoraEvents.remoraId, remoraIds))
        .groupBy(remoraEvents.remoraId)
    : [];
  return rows.map((row) => {
    const team = TeamFile.safeParse(row.team);
    const mine = hatched.filter((f) => f.templateId === row.templateId);
    const theirs = new Set(mine.flatMap((f) => f.remoraIds));
    const o = outcomes.filter((x) => theirs.has(x.remoraId));
    const useful = o.reduce((s, x) => s + Number(x.useful), 0);
    const spent = o.reduce((s, x) => s + Number(x.spent), 0);
    return {
      templateId: row.templateId,
      network: row.network as SuiNetwork,
      blobId: row.blobId,
      author: row.author,
      parent: row.parent,
      name: row.name ?? "Loading…",
      description: row.description,
      permissions: team.success ? permissionsOf(team.data) : [],
      forks: Number(forks.find((f) => f.templateId === row.templateId)?.n ?? 0),
      deprecated: row.deprecated,
      safety: row.verdict === "unknown" ? "warn" : row.verdict,
      publishedAt: row.publishedAt.toISOString(),
      publishDigest: row.publishDigest,
      stats: mine.length
        ? {
            hatched: mine.length,
            usefulAnswers: useful,
            costPerUsefulUsdc: useful ? (spent / 1e6 / useful).toFixed(4) : null,
          }
        : null,
    };
  });
}

export async function gallery(
  h: HatcheryDeps,
  network: SuiNetwork,
  filter: { q?: string; kind?: string } = {},
) {
  const rows = await h.runtime.db
    .select()
    .from(hatcheryTemplates)
    .where(eq(hatcheryTemplates.network, network))
    .orderBy(desc(hatcheryTemplates.publishedAt))
    .limit(200);
  const q = filter.q?.toLowerCase().trim();
  const picked = rows.filter((r) => {
    if (q && !`${r.name ?? ""} ${r.description ?? ""}`.toLowerCase().includes(q)) return false;
    if (filter.kind) {
      const team = TeamFile.safeParse(r.team);
      if (!team.success || !team.data.remoras.some((x) => x.template === filter.kind)) return false;
    }
    return true;
  });
  return toListings(h, picked);
}

export async function listing(h: HatcheryDeps, network: SuiNetwork, templateId: string) {
  const [row] = await h.runtime.db
    .select()
    .from(hatcheryTemplates)
    .where(
      and(
        eq(hatcheryTemplates.network, network),
        eq(hatcheryTemplates.templateId, normalizeSuiAddress(templateId)),
      ),
    );
  if (!row) throw new RemoraError("hatchery.not_found", "No template with that id here.", 404);
  const [l] = await toListings(h, [row]);
  return { listing: l as HatcheryListing, row };
}

/** The page link, and a Telegram deep link (start parameters max out at 64 characters, so an id prefix). */
export const shareLinks = (h: HatcheryDeps, templateId: string) => ({
  url: `${h.webBase}/hatchery/${templateId}`,
  telegram: h.telegramBot
    ? `https://t.me/${h.telegramBot}?start=tpl_${templateId.slice(2, 34)}`
    : null,
});

// ── M5: hatch ────────────────────────────────────────────────────────────────

export async function consent(
  h: HatcheryDeps,
  network: SuiNetwork,
  templateId: string,
): Promise<HatchConsent & { markdown: string }> {
  const { listing: l, row } = await listing(h, network, templateId);
  // Read the blob back from Walrus: what's hatched is what's onchain, not our cached copy.
  const markdown = await h.walrus.get(network, row.blobId).catch(() => row.markdown ?? "");
  if (!markdown)
    throw new RemoraError(
      "hatchery.unreadable",
      "That template can't be read from Walrus right now.",
      409,
    );
  const { team } = parseTeamMarkdown(markdown);
  const safety = await review(h, network, team, markdown);
  const reef = h.runtime.reef(network);
  const permissions = permissionsOf(team);
  const refs = [...new Set(permissions.flatMap((p) => p.payees))];
  return {
    listing: { ...l, safety: safety.verdict },
    team,
    permissions,
    payees: refs.map((ref) => {
      const e = reef.find((x) => x.ref === ref);
      return {
        ref: ref as `reef:${string}`,
        name: e?.name ?? ref,
        priceUsdc: e ? usdText(Number(e.price) / 1e6) : null,
        known: !!e,
      };
    }),
    safety,
    startsInShadow: true,
    // One signature: every Disc issue and the fork record go in the same transaction.
    signatures: 1,
    markdown,
  };
}

export async function hatchTx(
  h: HatcheryDeps,
  owner: string,
  network: SuiNetwork,
  templateId: string,
) {
  const { pkg, registry } = hatcheryIds(h, network);
  const c = await consent(h, network, templateId);
  if (c.listing.deprecated)
    throw new RemoraError("hatchery.deprecated", "Its author deprecated this template.", 409);
  if (c.safety.verdict === "block")
    throw new RemoraError(
      "hatchery.blocked",
      `This can't be hatched: ${c.safety.findings.find((f) => f.severity === "block")?.detail ?? "it failed the safety review."}`,
      409,
    );
  const applied = await applyTeam(h.runtime, h.service, owner, network, c.markdown);
  const tx = applied.transaction ? Transaction.from(applied.transaction) : new Transaction();
  tx.moveCall({
    target: `${pkg}::hatchery::fork`,
    arguments: [tx.object(registry), tx.object(c.listing.templateId)],
  });
  tx.setSender(normalizeSuiAddress(owner));
  return {
    transaction: await tx.toJSON(),
    remoras: applied.remoras,
    roomId: applied.roomId,
    skipped: applied.skipped,
  };
}

export async function confirmHatch(
  h: HatcheryDeps,
  owner: string,
  network: SuiNetwork,
  input: { templateId: string; remoraIds: string[]; digest: string; pack?: string[] },
) {
  const { pkg } = hatcheryIds(h, network);
  const tx = await readTx(h, network, input.digest, owner);
  const templateId = normalizeSuiAddress(input.templateId);
  const fork = decodeHatcheryEvents(pkg, tx.events).find(
    (e) => e.type === "Forked" && e.template === templateId && e.by === normalizeSuiAddress(owner),
  );
  if (!fork)
    throw new RemoraError("hatchery.no_fork", "That transaction didn't hatch this template.");
  const { confirmed } = await confirmTeam(
    h.runtime,
    h.service,
    owner,
    input.remoraIds,
    input.digest,
  );
  await h.runtime.db
    .insert(hatcheryForks)
    .values({
      network,
      templateId,
      by: normalizeSuiAddress(owner),
      txDigest: input.digest,
      eventSeq: fork.seq,
      remoraIds: input.remoraIds,
    })
    .onConflictDoUpdate({
      target: [hatcheryForks.txDigest, hatcheryForks.eventSeq],
      set: { remoraIds: input.remoraIds },
    });
  const imported = await importPack(h, owner, network, templateId, input.remoraIds, input.pack);
  return { confirmed, remoras: input.remoraIds, digest: input.digest, imported };
}

/**
 * ADR-0131: the starter memories the hatcher ticked, from the template's own pack only, written to
 * its first remora's `sources` (or a Wallet watcher's `rules`), each marked with where it came from.
 */
async function importPack(
  h: HatcheryDeps,
  owner: string,
  network: SuiNetwork,
  templateId: string,
  remoraIds: string[],
  picked: string[] = [],
) {
  if (!picked.length) return 0;
  const { row } = await listing(h, network, templateId);
  const team = TeamFile.safeParse(row.team);
  const pack = new Set(team.success ? (team.data.pack ?? []) : []);
  const lines = [...new Set(picked)].filter((t) => pack.has(t) && !privateReason(t));
  const [first] = remoraIds;
  if (!lines.length || !first) return 0;
  const r = await h.service.get(first, owner);
  const ns = answersQuestions(r.template) ? "sources" : "rules";
  const source = `SOURCE: pack ${templateId.slice(0, 10)}`;
  let n = 0;
  for (const line of lines) {
    const ok = await h.runtime.memory
      .remember(r, ns, answersQuestions(r.template) ? "source" : "rule", `${line} · ${source}`, {
        dedupe: false,
      })
      .then(() => true)
      .catch((err) => {
        h.runtime.log.warn("hatchery.pack_failed", { remora: r.id, error: err });
        return false;
      });
    if (ok) n++;
  }
  await h.runtime.db.insert(remoraEvents).values({
    remoraId: r.id,
    network: r.network,
    type: "action",
    summary: `Started with ${n} memories from the template's public pack.`,
    payload: { kind: "pack_imported", templateId, count: n },
  });
  return n;
}

// ── Deprecate (author only) ──────────────────────────────────────────────────

export async function deprecateTx(
  h: HatcheryDeps,
  owner: string,
  network: SuiNetwork,
  templateId: string,
) {
  const { pkg, registry } = hatcheryIds(h, network);
  const { row } = await listing(h, network, templateId);
  if (row.author !== normalizeSuiAddress(owner))
    throw new RemoraError("hatchery.not_author", "Only its author can deprecate a template.", 403);
  const tx = new Transaction();
  tx.moveCall({
    target: `${pkg}::hatchery::deprecate`,
    arguments: [tx.object(registry), tx.object(row.templateId)],
  });
  tx.setSender(normalizeSuiAddress(owner));
  return { transaction: await tx.toJSON() };
}

export async function confirmDeprecate(
  h: HatcheryDeps,
  owner: string,
  network: SuiNetwork,
  digest: string,
) {
  const { pkg } = hatcheryIds(h, network);
  const tx = await readTx(h, network, digest, owner);
  const d = decodeHatcheryEvents(pkg, tx.events).find((e) => e.type === "Deprecated");
  if (!d)
    throw new RemoraError("hatchery.no_deprecate", "That transaction didn't deprecate a template.");
  await h.runtime.db
    .update(hatcheryTemplates)
    .set({ deprecated: true })
    .where(eq(hatcheryTemplates.templateId, d.template));
  return listing(h, network, d.template);
}

// ── The indexer's side: templates published or hatched anywhere ─────────────

export async function onIndexedEvents(
  h: HatcheryDeps,
  network: SuiNetwork,
  events: { digest: string; events: HatcheryEvent[] }[],
) {
  for (const { digest, events: list } of events) {
    for (const e of list) {
      if (e.type === "Published") {
        await ingest(h, network, e, digest).catch((err) =>
          h.runtime.log.warn("hatchery.ingest_failed", { template: e.template, error: err }),
        );
      } else if (e.type === "Forked") {
        await h.runtime.db
          .insert(hatcheryForks)
          .values({ network, templateId: e.template, by: e.by, txDigest: digest, eventSeq: e.seq })
          .onConflictDoNothing();
      } else {
        await h.runtime.db
          .update(hatcheryTemplates)
          .set({ deprecated: true })
          .where(eq(hatcheryTemplates.templateId, e.template));
      }
    }
  }
}

export type { Remora };
