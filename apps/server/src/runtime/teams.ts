/**
 * Teams from Markdown (ADR-0042): a whole team in one file, YAML frontmatter (`remora.team/v1`) over a
 * playbook people can read.
 * - `preview` validates and describes what an import would create, and writes nothing.
 * - `apply` creates every remora with all Disc issues in ONE owner transaction, then sets models,
 *   personas, rules (taught now), schedules (paused) and the Team room.
 * - `export` writes the owner's team back, without keys, memories, Disc or allowance ids, or the
 *   addresses Sentinels watch.
 */
import type { SuiNetwork } from "@remora/chain";
import { and, eq, inArray, remoras, rooms, sentinelRules } from "@remora/db";
import {
  type Budget,
  isCatalogModel,
  type TeamFile as Team,
  TeamFile,
  type TeamPreview,
} from "@remora/schema";
import { parseDocument, stringify, visit } from "yaml";
import { TEMPLATES } from "../templates/index.ts";
import { previewSchedule } from "../triggers/schedule.ts";
import type { RuntimeDeps } from "./deps.ts";
import { type Remora, RemoraError, type RemoraService } from "./remoras.ts";
import { defaultRoom } from "./rooms.ts";
import { parseRule } from "./rules.ts";
import { addSchedule, queueFirstRun } from "./schedules.ts";
import { teach } from "./sentinel.ts";

const USDC = 1_000_000;
const MAX_BYTES = 64_000;
const usd = (units: string) => Number(units) / USDC;
const usdText = (n: number) => (n < 0.1 ? n.toFixed(3).replace(/0$/, "") : n.toFixed(2));

/** Splits `---\nyaml\n---\nbody` and validates the frontmatter. */
export function parseTeamMarkdown(markdown: string): { team: Team; playbook: string } {
  if (markdown.length > MAX_BYTES)
    throw new RemoraError("team.too_big", "That file is too big for a team (64 KB at most).");
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(markdown.trimStart());
  if (!m)
    throw new RemoraError(
      "team.no_frontmatter",
      "A team file starts with --- YAML --- frontmatter.",
    );
  let data: unknown;
  try {
    // Plain data only: no custom tags, no anchors expanded into huge documents.
    const doc = parseDocument(m[1] ?? "", { customTags: [] });
    if (doc.errors.length) throw doc.errors[0];
    // YAML reads an unquoted 0x… address as a hex number (and loses digits); keep its text.
    visit(doc, {
      Scalar(_key, node) {
        const source = (node as { source?: unknown }).source;
        if (
          typeof node.value === "number" &&
          typeof source === "string" &&
          /^0x[0-9a-f]+$/i.test(source)
        )
          node.value = source;
      },
    });
    data = doc.toJS({ maxAliasCount: 0 });
  } catch (err) {
    throw new RemoraError(
      "team.bad_yaml",
      `The frontmatter isn't valid YAML: ${(err as Error).message.split("\n")[0]}`,
    );
  }
  const res = TeamFile.safeParse(data);
  if (!res.success) {
    const first = res.error.issues[0];
    throw new RemoraError(
      "team.invalid",
      `The team file isn't right at ${first?.path.join(".") || "the top"}: ${first?.message ?? "invalid"}.`,
    );
  }
  const names = res.data.remoras.map((r) => r.name.toLowerCase());
  if (new Set(names).size !== names.length)
    throw new RemoraError("team.duplicate_names", "Two remoras in the file share a name.");
  for (const r of res.data.remoras) {
    if (!(r.template in TEMPLATES))
      throw new RemoraError("template.unknown", `No template called ${r.template}.`);
  }
  return { team: res.data, playbook: (m[2] ?? "").trim() };
}

const budgetOf = (r: Team["remoras"][number], coinType: string): Budget | undefined => {
  if (!r.budget) return undefined;
  const t = TEMPLATES[r.template as keyof typeof TEMPLATES];
  return {
    coinType,
    windowLimit: String(Math.round(r.budget.monthlyUsd * USDC)),
    window: "month",
    perPaymentCap: String(Math.round(r.budget.perPaymentUsd * USDC)),
    payees: [...t.payees],
  };
};

/** What an import would create. Nothing is written. */
export function previewTeam(markdown: string): TeamPreview {
  const { team, playbook } = parseTeamMarkdown(markdown);
  const warnings: string[] = [];
  const out = team.remoras.map((r) => {
    const t = TEMPLATES[r.template as keyof typeof TEMPLATES];
    const paying = t.payees.length > 0;
    if (r.model && !isCatalogModel(r.model))
      warnings.push(`${r.name}'s model ${r.model} isn't in the catalog: it will use the default.`);
    if (r.template === "sentinel" && !r.watch.length)
      warnings.push(`${r.name} watches no address yet: it will watch yours.`);
    if (!paying && r.budget) warnings.push(`${r.name} is read-only: its budget is ignored.`);
    if (r.template !== "sentinel" && r.rules.length)
      warnings.push(`Only Wallet watchers learn rules: ${r.name}'s rules are ignored.`);
    if (r.template !== "scout" && r.schedules.length)
      warnings.push(`Only Researchers answer on a schedule: ${r.name}'s schedules are ignored.`);
    const b = paying ? (r.budget ?? { monthlyUsd: 1, perPaymentUsd: 0.05 }) : null;
    return {
      name: r.name,
      template: r.template,
      model: isCatalogModel(r.model) ? r.model : null,
      budget: b
        ? `${usdText(b.monthlyUsd)} USDC a month, at most ${usdText(b.perPaymentUsd)} a payment`
        : null,
      watch: r.watch.length,
      rules:
        r.template === "sentinel"
          ? r.rules.map((text) => ({ text, understood: !!parseRule(text) }))
          : [],
      schedules:
        r.template === "scout"
          ? r.schedules.map((s) => ({
              when: s.when,
              human: previewSchedule(s.when)?.human ?? null,
              question: s.question,
            }))
          : [],
      needsDisc: paying,
    };
  });
  for (const r of out) {
    for (const rule of r.rules)
      if (!rule.understood)
        warnings.push(`${r.name} will try to read "${rule.text}" with its model at import.`);
    for (const s of r.schedules)
      if (!s.human)
        warnings.push(`"${s.when}" isn't a schedule Remora understands: it will be skipped.`);
  }
  if (team.room?.lead && !team.remoras.some((r) => r.name === team.room?.lead))
    warnings.push(`The room's lead ${team.room.lead} isn't in the team.`);
  return {
    team,
    playbook,
    remoras: out,
    signatures: out.some((r) => r.needsDisc) ? 1 : 0,
    warnings,
  };
}

/** Creates the team. Returns the remoras and, if any needs a Disc, ONE owner transaction for all. */
export async function applyTeam(
  deps: RuntimeDeps,
  service: RemoraService,
  owner: string,
  network: SuiNetwork,
  markdown: string,
) {
  const { team } = parseTeamMarkdown(markdown);
  const coinType = deps.networks.config(network).usdcCoinType;
  const { remoras: made, transaction } = await service.createTeam(
    owner,
    network,
    team.remoras.map((r) => {
      const budget = budgetOf(r, coinType);
      return {
        template: r.template,
        name: r.name,
        ...(budget && TEMPLATES[r.template as keyof typeof TEMPLATES].payees.length
          ? { budget }
          : {}),
        ...(r.template === "sentinel" ? { watch: r.watch.length ? r.watch : [owner] } : {}),
      };
    }),
  );
  const skipped: string[] = [];
  for (const [i, r] of made.entries()) {
    const spec = team.remoras[i];
    if (!spec) continue;
    let current: Remora = r;
    if (spec.persona || isCatalogModel(spec.model)) {
      current = await service.edit(r.id, owner, {
        ...(spec.persona ? { persona: spec.persona } : {}),
        ...(isCatalogModel(spec.model) ? { model: spec.model } : {}),
      });
    }
    if (current.template === "sentinel") {
      for (const text of spec.rules) {
        await teach(deps, current, text).catch(() => skipped.push(`${current.name}: "${text}"`));
      }
    }
    if (current.template === "scout") {
      for (const s of spec.schedules) {
        const [fresh] = await deps.db.select().from(remoras).where(eq(remoras.id, current.id));
        await addSchedule(deps, fresh ?? current, s.when, s.question, { paused: true }).catch(() =>
          skipped.push(`${current.name}: "${s.when}"`),
        );
      }
    }
  }
  const room = await defaultRoom(deps.db, owner, network);
  const lead = team.room?.lead ? made.find((r) => r.name === team.room?.lead) : undefined;
  const roomSet = {
    ...(team.room?.name ? { name: team.room.name } : {}),
    ...(team.room?.responder ? { responder: team.room.responder } : {}),
    ...(lead ? { leadId: lead.id } : {}),
  };
  // A shared remora (a team of one, ADR-0046) comes without a room: leave the owner's as it is.
  if (Object.keys(roomSet).length)
    await deps.db.update(rooms).set(roomSet).where(eq(rooms.id, room.id));
  // Disc-less remoras are ready now; the rest after the owner's one signature (confirmTeam).
  for (const r of made) if (r.status !== "creating") await queueFirstRun(deps, r.id);
  return { remoras: made.map((r) => r.id), transaction, roomId: room.id, skipped };
}

/** After the owner executed the team's transaction: confirm every remora's Disc from it. */
export async function confirmTeam(
  deps: RuntimeDeps,
  service: RemoraService,
  owner: string,
  ids: string[],
  digest: string,
) {
  const confirmed: string[] = [];
  for (const id of ids) {
    const r = await service.get(id, owner);
    if (r.status !== "creating") continue;
    await service.confirmIssue(id, owner, digest);
    await queueFirstRun(deps, id);
    confirmed.push(id);
  }
  return { confirmed };
}

/**
 * The owner's team on this network as a team file. With `ids`, only those remoras, without the room:
 * that's how one remora is shared in the Hatchery (a team of one, ADR-0046).
 */
export async function exportTeam(
  deps: RuntimeDeps,
  owner: string,
  network: SuiNetwork,
  opts: { ids?: string[]; name?: string; description?: string } = {},
) {
  const mine = (
    await deps.db
      .select()
      .from(remoras)
      .where(
        and(
          eq(remoras.ownerAddress, owner),
          eq(remoras.network, network),
          eq(remoras.playground, false),
        ),
      )
  ).filter(
    (r) =>
      r.status !== "retired" && r.status !== "creating" && (!opts.ids || opts.ids.includes(r.id)),
  );
  if (!mine.length) throw new RemoraError("team.empty", "You have no remoras to export yet.", 404);
  const rules = await deps.db
    .select({ remoraId: sentinelRules.remoraId, text: sentinelRules.text })
    .from(sentinelRules)
    .where(
      and(
        inArray(
          sentinelRules.remoraId,
          mine.map((r) => r.id),
        ),
        eq(sentinelRules.active, true),
      ),
    );
  const room = await defaultRoom(deps.db, owner, network);
  const lead = mine.find((r) => r.id === room.leadId);
  // Owners may reuse a name; a team file can't (names are how rooms pick a lead).
  const seen = new Map<string, number>();
  const unique = (name: string) => {
    const n = (seen.get(name.toLowerCase()) ?? 0) + 1;
    seen.set(name.toLowerCase(), n);
    return n === 1 ? name : `${name.slice(0, 36)} ${n}`;
  };
  const names = new Map(mine.map((r) => [r.id, unique(r.name)]));
  const team: Team = {
    schema: "remora.team/v1",
    name: opts.name ?? (room.name === "Team" ? "My Remora team" : room.name),
    description:
      opts.description ?? `Exported from Remora on ${new Date().toISOString().slice(0, 10)}.`,
    remoras: mine.map((r) => {
      const c = r.config as {
        persona?: string;
        model?: string;
        budget?: { windowLimit: string; perPaymentCap: string } | null;
        schedules?: { cron: string; question: string }[];
      };
      const t = TEMPLATES[r.template as keyof typeof TEMPLATES];
      return {
        template: r.template,
        name: names.get(r.id) ?? r.name,
        ...(c.persona && c.persona !== t?.persona ? { persona: c.persona } : {}),
        ...(isCatalogModel(c.model) ? { model: c.model } : {}),
        ...(c.budget
          ? {
              budget: {
                monthlyUsd: usd(c.budget.windowLimit),
                perPaymentUsd: usd(c.budget.perPaymentCap),
              },
            }
          : {}),
        // Never the addresses this owner watches.
        watch: [],
        rules: rules.filter((x) => x.remoraId === r.id).map((x) => x.text),
        schedules: (c.schedules ?? []).map((s) => ({ when: s.cron, question: s.question })),
      };
    }),
    ...(opts.ids
      ? {}
      : {
          room: {
            name: room.name,
            responder: room.responder,
            ...(lead ? { lead: names.get(lead.id) ?? lead.name } : {}),
          },
        }),
  };
  TeamFile.parse(team);
  const body = [
    `# ${team.name}`,
    "",
    ...team.remoras.map(
      (r) =>
        `- **${r.name}** (${r.template})${r.budget ? `: up to ${r.budget.monthlyUsd} USDC a month, at most ${r.budget.perPaymentUsd} a payment` : ""}`,
    ),
    "",
    opts.ids
      ? "Use it from Remora's Templates. It starts in practice mode, its schedules arrive paused, and a Wallet watcher watches your own address."
      : "Import it in Remora under Remoras → Import. Remoras start in practice mode and schedules arrive paused. Wallet watchers watch the importer's own address until they're told otherwise.",
  ].join("\n");
  return `---\n${stringify(team).trimEnd()}\n---\n\n${body}\n`;
}
