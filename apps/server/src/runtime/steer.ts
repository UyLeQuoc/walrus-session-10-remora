/**
 * U18 C1 + C2 (ADR-0123): steering in words, bound once and shared by the web routes, web chat (1-1
 * threads and rooms) and Telegram. Drafts and change cards only propose; the owner reviews, taps or
 * signs. The model is the small parse model, behind a port so tests use a fake.
 */
import type { SuiNetwork } from "@remora/chain";
import { remoraEvents, roomMessages } from "@remora/db";
import { generateObject, type LanguageModel } from "ai";
import {
  applyChange,
  type ChangeDeps,
  COMMAND_SYSTEM,
  CommandAnswer,
  type CommandModel,
  changeTx,
  confirmChange,
  declineChange,
  type Plan,
  proposeChange,
  viewChange,
} from "./commands.ts";
import {
  DRAFT_SYSTEM,
  DraftAnswer,
  type DraftModel,
  draftRemora,
  type SetupInput,
  setupHatched,
} from "./draft.ts";
import type { Button } from "./notify.ts";
import { type Remora, RemoraError } from "./remoras.ts";
import { mirror, type Room } from "./rooms.ts";

export interface SteerDeps extends ChangeDeps {
  draft: DraftModel;
}

/** Both parses on one structured-output model (the small parse model in production). */
export function steerModel(model: LanguageModel): { draft: DraftModel; parse: CommandModel } {
  return {
    async draft(input) {
      const r = await generateObject({
        model,
        schema: DraftAnswer,
        system: DRAFT_SYSTEM,
        prompt: JSON.stringify(input),
        maxRetries: 1,
      });
      return r.object;
    },
    async parse(input) {
      const r = await generateObject({
        model,
        schema: CommandAnswer,
        system: COMMAND_SYSTEM,
        prompt: JSON.stringify(input),
        maxRetries: 1,
      });
      return r.object;
    },
  };
}

/** The sign link a card's owner opens to sign it in their wallet. */
export const signLink = (webBase: string, eventId: string) => `${webBase}/changes/${eventId}`;

/** A change card as a Telegram message: the diff, then Apply, or a sign link for anything signed. */
export function telegramCard(
  webBase: string,
  eventId: string,
  plan: Pick<Plan, "title" | "diff" | "sign" | "note">,
): { text: string; buttons: Button[] } {
  const url = signLink(webBase, eventId);
  const lines = [
    plan.title,
    ...plan.diff.map((x) => `${x.label}: ${x.before} → ${x.after}`),
    ...(plan.note ? [plan.note] : []),
    ...(plan.sign ? [`Sign it in your wallet: ${url}`] : []),
  ];
  const cancel = { label: "Cancel", data: `chg:${eventId}:x` };
  return {
    text: lines.join("\n"),
    buttons: plan.sign
      ? [{ label: "Sign in wallet", url }, cancel]
      : [{ label: "Apply", data: `chg:${eventId}:a` }, cancel],
  };
}

const CHANGE_TAP = /^chg:([0-9a-f-]{36}):(a|x)$/;

export function createSteer(d: SteerDeps) {
  const rt = d.runtime;
  return {
    /** C1: the owner's words → a draft create input, or a refusal. */
    async draft(owner: string, network: SuiNetwork, text: string) {
      if (!rt.limiter.take(`draft:${owner}`, { limit: 6, ms: 60_000 }).allowed)
        throw new RemoraError(
          "draft.busy",
          "That's a lot of drafts at once. Try in a minute.",
          409,
        );
      const coinType = rt.networks.config(network).usdcCoinType;
      if (!coinType) throw new RemoraError("network.unavailable", `${network} isn't available.`);
      return draftRemora(
        d.draft,
        { templates: d.service.templates(), reef: rt.reef(network), owner, coinType },
        text,
      );
    },

    setup: (owner: string, id: string, input: SetupInput) =>
      setupHatched(rt, d.service, owner, id, input),

    /** A 1-1 thread: the card (or the question back) as the thread remora's event. */
    inThread: async (here: Remora, text: string): Promise<string[] | null> => {
      const out = await proposeChange(d, here.ownerAddress, here.network, text, {
        here,
        from: "web",
      });
      if (!out) return null;
      if (!("reply" in out)) return [out.eventId];
      const [e] = await rt.db
        .insert(remoraEvents)
        .values({
          remoraId: here.id,
          network: here.network,
          type: "action",
          summary: out.reply,
          payload: { kind: "steer" },
        })
        .returning({ id: remoraEvents.id });
      return e ? [e.id] : [];
    },

    /** A room: the owner's line, then the card as the target's line, or the question as a system line. */
    inRoom: async (room: Room, text: string) => {
      const out = await proposeChange(d, room.ownerAddress, room.network, text, { from: "web" });
      if (!out) return null;
      const routedTo = "reply" in out ? [] : [out.target.id];
      const [line] = await rt.db
        .insert(roomMessages)
        .values({ roomId: room.id, author: "owner", text, routedTo, route: "signal" })
        .returning();
      if (!line) throw new RemoraError("room.post_failed", "Couldn't post that.");
      const reply =
        "reply" in out
          ? (
              await rt.db
                .insert(roomMessages)
                .values({ roomId: room.id, author: "system", text: out.reply, replyTo: line.id })
                .returning()
            )[0]
          : await mirror(rt.db, room.id, out.target, out.eventId, line.id);
      return {
        messageId: line.id,
        routedTo,
        route: "signal" as const,
        replies: reply ? [reply.id] : [],
      };
    },

    /** Telegram: a card with Apply or a sign link; null lets the line go on as a message. */
    inTelegram: async (
      owner: string,
      network: SuiNetwork,
      text: string,
    ): Promise<{ text: string; buttons?: Button[] } | null> => {
      const out = await proposeChange(d, owner, network, text, { from: "telegram" });
      if (!out) return null;
      if ("reply" in out) return { text: out.reply };
      return telegramCard(rt.webBase, out.eventId, out.plan);
    },

    /** Telegram's Apply / Cancel buttons (`chg:<id>:a|x`); null for anyone else's buttons. */
    tap: async (owner: string, data: string): Promise<string | null> => {
      const m = CHANGE_TAP.exec(data);
      if (!m?.[1]) return null;
      try {
        const out =
          m[2] === "a" ? await applyChange(d, owner, m[1]) : await declineChange(d, owner, m[1]);
        return out.change.status === "applied" ? `Done: ${out.change.title}.` : "Cancelled.";
      } catch (err) {
        if (err instanceof RemoraError) return err.message;
        throw err;
      }
    },

    view: (owner: string, id: string) => viewChange(d, owner, id),
    apply: (owner: string, id: string) => applyChange(d, owner, id),
    decline: (owner: string, id: string) => declineChange(d, owner, id),
    tx: (owner: string, id: string) => changeTx(d, owner, id),
    confirm: (owner: string, id: string, digest: string) => confirmChange(d, owner, id, digest),
  };
}

export type Steer = ReturnType<typeof createSteer>;
