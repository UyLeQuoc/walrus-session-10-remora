/**
 * H1 + A5: the remora side of the Telegram bot, ahead of the hippo chat. Commands act for the wallet
 * this chat is linked to (A5); anything that moves money or changes a Disc needs the owner's
 * signature, so those commands answer with a dashboard link instead of acting. Name a remora at the
 * start of a message ("Scout, is 0x2 safe?") to talk to it. Returns null for everything else.
 */
import type { SuiNetwork } from "@remora/chain";
import {
  and,
  approvals,
  eq,
  hatcheryTemplates,
  like,
  receipts,
  remoraEvents,
  remoras,
} from "@remora/db";
import type { RuntimeDeps } from "../runtime/deps.ts";
import { errandAsk } from "../runtime/errand.ts";
import { giveFeedback } from "../runtime/feedback.ts";
import type { Button } from "../runtime/notify.ts";
import { type Remora, RemoraError, type RemoraService } from "../runtime/remoras.ts";
import { answerButtons } from "../runtime/schedules.ts";
import { scoutAsk } from "../runtime/scout.ts";
import { teach } from "../runtime/sentinel.ts";
import { isTemplateSlug, TEMPLATES } from "../templates/index.ts";

/** ADR-0101: a remora's kind in plain words ("Researcher", "Wallet watcher"). */
const kindOf = (template: string) =>
  isTemplateSlug(template) ? TEMPLATES[template].name : template;

export interface BotReply {
  text: string;
  buttons?: Button[];
}

export interface RemoraBotDeps {
  runtime: RuntimeDeps;
  service: RemoraService;
  /** The wallet this Telegram user linked (A5), or null. */
  ownerOf: (telegramId: string) => Promise<string | null>;
  /** Redeems a dashboard link code for this Telegram user; returns the sentence to send. */
  link: (telegramId: string, displayName: string, code: string) => Promise<string>;
  network?: SuiNetwork;
}

const NOT_LINKED =
  "This chat isn't linked to a wallet yet. Open the dashboard → Settings → Link Telegram, then tap the link it gives you.";

const usd = (units: string | bigint) => `$${(Number(units) / 1e6).toFixed(2)}`;

export function createRemoraBot(d: RemoraBotDeps) {
  const rt = d.runtime;
  const network = () => d.network ?? rt.networks.default;
  const web = (path: string) => `${rt.webBase}${path}`;
  const live = (r: Remora) => r.status === "active" || r.status === "shadow";

  const mine = async (owner: string) => d.service.list(owner, network());
  const byName = (rows: Remora[], name: string) =>
    rows.find((r) => r.name.toLowerCase() === name.trim().toLowerCase() && r.status !== "retired");

  const ask = async (r: Remora, question: string): Promise<BotReply> => {
    // ADR-0125: "Errand, pay Linh 2 USDC for lunch".
    if (r.template === "errand") {
      const res = await errandAsk(rt, r, question.slice(0, 500), {
        kind: "message",
        ref: "telegram",
      });
      return { text: res.answer, buttons: answerButtons(rt.webBase, r, res.eventId) };
    }
    if (r.template !== "scout") return { text: `${r.name} doesn't answer questions. Try /teach.` };
    const res = await scoutAsk(rt, r, question.slice(0, 1_000), {
      kind: "message",
      ref: "telegram",
    });
    return { text: res.answer, buttons: answerButtons(rt.webBase, r, res.eventId) };
  };

  async function command(
    from: { id: string; name: string },
    text: string,
  ): Promise<BotReply | null> {
    const t = text.trim();
    const [raw = "", ...rest] = t.split(/\s+/);
    const cmd = raw.startsWith("/") ? raw.slice(1).split("@")[0]?.toLowerCase() : null;
    const arg = rest.join(" ").trim();

    // A5: /start link_<code> from the dashboard's deep link.
    if (cmd === "start" && /^link_[A-Za-z2-9]{6}$/.test(arg)) {
      return { text: await d.link(from.id, from.name, arg.slice(5)) };
    }
    // M3: /start tpl_<id prefix> from a Hatchery share link. Hatching needs the wallet, so it's the web.
    if (cmd === "start" && /^tpl_[0-9a-f]{8,62}$/.test(arg)) {
      const [tpl] = await rt.db
        .select({ id: hatcheryTemplates.templateId, name: hatcheryTemplates.name })
        .from(hatcheryTemplates)
        .where(like(hatcheryTemplates.templateId, `0x${arg.slice(4)}%`))
        .limit(1);
      if (!tpl) return { text: "That template isn't shared yet." };
      return {
        text: `${tpl.name ?? "This remora"} is a shared template. Review what it can do and make your copy with your wallet: ${web(`/hatchery/${tpl.id}`)}`,
      };
    }
    const known = [
      "remoras",
      "scout",
      "ask",
      "teach",
      "budget",
      "pause",
      "resume",
      "approvals",
      "panic",
      "pay",
    ];
    if (cmd && !known.includes(cmd)) return null;

    const owner = await d.ownerOf(from.id);
    if (!cmd) {
      // "Scout, …" / "Scout: …" addresses a remora by name.
      const m = /^([\p{L}\p{N} _-]{1,40})[,:]\s*(.+)$/su.exec(t);
      if (!m || !owner) return null;
      const r = byName(await mine(owner), m[1] ?? "");
      if (!r) return null;
      return ask(r, m[2] ?? "");
    }
    if (!owner) return { text: NOT_LINKED };
    const rows = await mine(owner);

    try {
      switch (cmd) {
        case "remoras": {
          if (!rows.length)
            return { text: `No remoras on ${network()} yet. Create one: ${web("/remoras/new")}` };
          return {
            text: rows
              .map((r) => {
                const kind = kindOf(r.template);
                return `• ${r.name}${r.name === kind ? "" : ` (${kind})`} is ${r.status}`;
              })
              .join("\n"),
          };
        }
        case "scout":
        case "ask": {
          const r = rows.find((x) => x.template === "scout" && live(x));
          if (!r) return { text: "You have no active Researcher." };
          if (!arg) return { text: `Ask ${r.name} something, e.g. /ask is 0x2 safe to depend on?` };
          return ask(r, arg);
        }
        case "pay": {
          const r = rows.find((x) => x.template === "errand" && live(x));
          if (!r) return { text: `You have no active Errand. Make one: ${web("/remoras/new")}` };
          if (!arg) return { text: "Who and how much? e.g. /pay Linh 2 USDC for lunch" };
          return ask(r, `pay ${arg}`);
        }
        case "teach": {
          const r = rows.find((x) => x.template === "sentinel" && live(x));
          if (!r) return { text: "You have no active Wallet watcher." };
          if (!arg)
            return {
              text: "Teach a rule in plain words, e.g. /teach ignore incoming SUI under 0.01",
            };
          const out = await teach(rt, r, arg.slice(0, 500));
          return { text: `${r.name} learned: ${out?.text ?? arg}` };
        }
        case "budget": {
          const lines: string[] = [];
          for (const r of rows.filter((x) => x.discId)) {
            const m = await d.service.budgetMeter(r.id, owner).catch(() => null);
            if (!m) continue;
            const left = m.window ? usd(BigInt(m.window.limit) - BigInt(m.window.spent)) : "?";
            const pace = m.forecast?.runsOutOn
              ? `, runs out ${m.forecast.runsOutOn} at this pace`
              : "";
            lines.push(
              `• ${r.name}: ${left} left this window, ${usd(m.perPaymentCap)} per payment${pace}`,
            );
          }
          return { text: lines.length ? lines.join("\n") : "No remora has a budget yet." };
        }
        case "pause":
        case "resume": {
          const r = arg ? byName(rows, arg) : undefined;
          if (!r) return { text: `Which one? /${cmd} <name>` };
          if (r.discId) {
            return {
              text: `${cmd === "pause" ? "Pausing" : "Resuming"} ${r.name}'s spending limit needs your signature.`,
              buttons: [{ label: "Open in dashboard", url: web(`/remoras/${r.id}`) }],
            };
          }
          await d.service.setPaused(r.id, owner, cmd === "pause");
          return { text: `${r.name} is ${cmd === "pause" ? "paused" : "back on"}.` };
        }
        case "approvals": {
          const ids = rows.map((r) => r.id);
          const pending = ids.length
            ? (await rt.db.select().from(approvals).where(eq(approvals.status, "pending"))).filter(
                (a) => ids.includes(a.remoraId),
              )
            : [];
          if (!pending.length) return { text: "Nothing is waiting for you." };
          return {
            text: pending.map((a) => `• ${a.summary}`).join("\n"),
            buttons: [{ label: "Review", url: web("/inbox") }],
          };
        }
        case "panic":
          return {
            text: "The panic button pauses every remora's spending with one signature.",
            buttons: [{ label: "Pause everything", url: web("/settings?panic=1") }],
          };
      }
    } catch (err) {
      if (err instanceof RemoraError) return { text: err.message };
      throw err;
    }
    return null;
  }

  /** Inline buttons: `fb:<eventId>:u|n` (👍/👎, N19), `why:<eventId>` (N4). */
  async function callback(from: { id: string }, data: string): Promise<string> {
    const owner = await d.ownerOf(from.id);
    if (!owner) return NOT_LINKED;
    const fb = /^fb:([0-9a-f-]{36}):(u|n)$/.exec(data);
    if (fb) {
      const out = await giveFeedback(
        rt,
        owner,
        fb[1] ?? "",
        fb[2] === "u" ? "useful" : "noise",
      ).catch((e) => (e instanceof RemoraError ? { learned: e.message } : Promise.reject(e)));
      return out.learned === "noted" ? "Thanks, noted." : `Learned: ${out.learned}`;
    }
    const why = /^why:([0-9a-f-]{36})$/.exec(data);
    if (why) {
      const [row] = await rt.db
        .select({ e: remoraEvents, r: remoras })
        .from(remoraEvents)
        .innerJoin(remoras, eq(remoras.id, remoraEvents.remoraId))
        .where(and(eq(remoraEvents.id, why[1] ?? ""), eq(remoras.ownerAddress, owner)));
      if (!row) return "I can't find that one.";
      const [w] = row.e.receiptId
        ? await rt.db.select().from(receipts).where(eq(receipts.id, row.e.receiptId))
        : [];
      const decision = (w?.wake as { intent?: { decision?: { reason?: string } } } | undefined)
        ?.intent?.decision;
      return [
        `${row.r.name}: ${row.e.summary}`,
        decision?.reason ? `Why: ${decision.reason}` : null,
        w
          ? `Receipt ${w.intentHash.slice(0, 12)}…${w.txDigest ? ` · tx ${w.txDigest}` : ""}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");
    }
    return "That button has expired.";
  }

  return { command, callback };
}

export type RemoraBot = ReturnType<typeof createRemoraBot>;
