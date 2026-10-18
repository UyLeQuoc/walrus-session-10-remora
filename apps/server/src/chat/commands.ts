/**
 * Slash commands, defined once and reused by every channel adapter.
 * An adapter passes the raw text; if it starts with a known command the
 * handler runs and the adapter posts the reply verbatim instead of calling the
 * model.
 */
import type { CommandTable } from "@remora/core/command-table";
import { and, desc, eq, memoryIndex, sql, turnLog } from "@remora/db";
import { guestScope, MEMORY_TYPES, type MemoryScope, RelayerExtras } from "@remora/memory";
import { db, model, operator } from "../context.ts";
import { env } from "../env/load.ts";
import { createLinkCode, redeemLinkCode } from "../identity/link.ts";
import { setMemoryEnabled } from "../identity/memory-flag.ts";
import {
  inheritedGuestScopes,
  ownMemoryOf,
  type Person,
  portFor,
  setHidden,
} from "../identity/persons.ts";
import { asDownload, type ExportDownload, exportFor } from "../memory/export-person.ts";
import {
  compareView,
  connectLinkView,
  disconnectLinkView,
  exportAttachedView,
  exportElsewhereView,
  exportSummary,
  exportWebView,
  forgetUsageView,
  helpView,
  hiddenMemoryView,
  linkCodeView,
  memoryListView,
  privacyView,
  proofView,
  searchView,
  sentence,
  welcomeView,
  whoamiView,
} from "./command-views.ts";
import { answerWithoutMemory, throughLastQuestion } from "./compare.ts";
import { modelMessages } from "./history.ts";
import { isConversationTurn } from "./turn-modes.ts";

export interface CommandContext {
  person: Person;
  channel: string;
  /** Rendered link the user can open to run the wallet flow. */
  connectUrl: (kind: "connect" | "disconnect") => Promise<string>;
  conversationId?: string;
}

export interface CommandResult {
  text: string;
  /** Sent as attachments where the channel can (Telegram, the CLI). */
  files?: ExportDownload[];
  /** Web only. Other channels send `text` and ignore this. */
  table?: CommandTable;
}

/** Channels whose adapter delivers `files`. The rest are told where to go. */
const ATTACHES = new Set(["telegram", "discord", "cli"]);

/**
 * `/export`: the person's memory as files they keep.
 *
 * Built fresh and handed over, never stored, since memory text never goes into
 * Postgres. The web chat points at the button on /me, which downloads the same
 * thing; channels that cannot carry a file say so rather than pretending.
 */
async function exportMemories(ctx: CommandContext): Promise<CommandResult> {
  const file = await exportFor(ctx.person, ctx.channel);
  const c = file.coverage;
  if (!c.memories) {
    return sentence("Nothing to export yet: I have not written anything about you.");
  }
  const summary = exportSummary(c.memories, c.withText, c.verified);
  const page = `${env.WEB_BASE_URL}/me`;
  if (ATTACHES.has(ctx.channel)) {
    return {
      ...exportAttachedView(summary),
      files: [asDownload(file, "md"), asDownload(file, "json")],
    };
  }
  if (ctx.channel === "web") return exportWebView(summary, page);
  return exportElsewhereView(summary, page);
}

/**
 * Metadata routes must be signed with the *same* credential the memory port
 * uses, not the operator key carrying someone else's account id. A mismatched
 * `x-account-id` is silently repaired to whatever the signing key resolves to
 * (see docs/issues/05), so signing with the operator key while naming a user's
 * account sends the call to the operator's account instead. `/memory forget`
 * would then report success having deleted nothing of the user's.
 */
function extrasFor(scope: MemoryScope): RelayerExtras {
  return new RelayerExtras({
    key: scope.key,
    accountId: scope.accountId,
    serverUrl: scope.serverUrl,
  });
}

async function whoami(ctx: CommandContext): Promise<CommandResult> {
  const { person } = ctx;
  const port = await portFor(person, ctx.channel);
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(memoryIndex)
    .where(ownMemoryOf(person.id));
  let relay: { count: number; bytes: number } | null = null;
  try {
    const stats = await extrasFor(port.scope).stats(port.scope.namespace);
    relay = { count: stats.memory_count, bytes: stats.storage_bytes };
  } catch {
    // Metadata routes are flaky; the local count above is the reliable one.
  }
  return whoamiView({
    mode: person.mode,
    namespace: port.scope.namespace,
    accountId: person.accountId,
    walletAddress: person.walletAddress,
    written: count,
    relay,
  });
}

async function listMemories(ctx: CommandContext): Promise<CommandResult> {
  const rows = await db
    .select()
    .from(memoryIndex)
    .where(ownMemoryOf(ctx.person.id))
    .orderBy(desc(memoryIndex.createdAt))
    .limit(30);
  return memoryListView(
    rows.map((row) => ({
      type: row.type,
      createdAt: row.createdAt,
      blobId: row.blobId,
      hidden: row.hiddenAt !== null,
    })),
  );
}

async function searchMemories(ctx: CommandContext, query: string): Promise<CommandResult> {
  if (!query.trim()) return sentence("Usage: /memory search <question>");
  const port = await portFor(ctx.person, ctx.channel);
  const hits = await port.recall({ query, limit: 8, maxDistance: 0.9 });
  return searchView(
    query,
    hits.map((hit) => ({
      text: hit.parsed?.text ?? hit.text,
      distance: hit.distance,
      blobId: hit.blob_id,
    })),
  );
}

async function setMemory(ctx: CommandContext, on: boolean): Promise<CommandResult> {
  await setMemoryEnabled(ctx.person.id, on);
  return sentence(
    on
      ? "Memory on. I will remember what matters from now on."
      : "Memory off. I will not read or write memory until you run /memory on. Nothing already stored is deleted.",
  );
}

/**
 * Stop using one memory, or start again.
 *
 * Walrus cannot delete or edit a blob, and the relayer can only forget a whole
 * namespace, so this is hippo's own filter: the memory stops being recalled
 * and stops counting as a duplicate. What it cannot do is said every time.
 */
async function hideOne(ctx: CommandContext, target: string, hide: boolean): Promise<CommandResult> {
  const verb = hide ? "forget" : "unhide";
  if (!target.trim()) return sentence(`Usage: /memory ${verb} <blob>, as /memory shows it.`);
  const out = await setHidden(ctx.person.id, target, hide);
  switch (out.kind) {
    case "too-short":
      return sentence("Give at least the first six characters of the blob, as /memory shows it.");
    case "none":
      return sentence(`None of your memories has a blob starting "${target.trim()}".`);
    case "ambiguous":
      return sentence(`That matches ${out.count} of your memories. Give more of the blob.`);
    case "done":
      return hiddenMemoryView({
        hide,
        type: out.type,
        blobId: out.blobId,
        owned: ctx.person.mode === "owned",
      });
  }
}

async function forget(ctx: CommandContext): Promise<CommandResult> {
  const port = await portFor(ctx.person, ctx.channel);
  /**
   * Every namespace that is this person's own. Once they own an account, what
   * they said as a guest is still in hippo's account and still read alongside
   * (see `alsoRead` in persons.ts), so forgetting only the owned namespace left
   * it recallable — while /privacy and /disconnect both promised otherwise.
   */
  const scopes = [port.scope];
  if (ctx.person.mode === "owned") scopes.push(guestScope(operator, ctx.person.id));
  // And any guest namespace a merge left behind, which recall also reads.
  scopes.push(...(await inheritedGuestScopes(ctx.person)));
  try {
    let deleted = 0;
    for (const scope of scopes) deleted += (await extrasFor(scope).forget(scope.namespace)).deleted;
    await db.delete(memoryIndex).where(ownMemoryOf(ctx.person.id));
    return sentence(
      `Removed ${deleted} memories from the search index, so I can no longer recall any of them.\n\nBeing straight with you about the limit: the encrypted blobs stay on Walrus until their storage epochs run out, and there is currently no way to delete them earlier. Nobody can read them without your account's keys, and I can no longer find them, but they are not gone.`,
    );
  } catch (e) {
    return sentence(`Could not reach the relayer: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function link(ctx: CommandContext, arg: string): Promise<CommandResult> {
  if (!arg.trim()) {
    const { code, expiresInMinutes } = await createLinkCode(ctx.person);
    return linkCodeView(code, expiresInMinutes);
  }
  const result = await redeemLinkCode(ctx.person, arg);
  if (result.ok) {
    return sentence(
      "Linked. This channel and the one that gave you the code now share the same memory.",
    );
  }
  switch (result.reason) {
    case "self":
      return sentence(
        "That code came from this same conversation. Run /link on the other channel instead.",
      );
    case "expired":
      return sentence(
        "That code has expired or was already used. Run /link on the other channel for a fresh one.",
      );
    default:
      return sentence(
        "That does not look like a link code. Run /link on the other channel to get one.",
      );
  }
}

async function lastAnswerMemories(ctx: CommandContext) {
  const [last] = await db
    .select({ injected: turnLog.injected })
    .from(turnLog)
    .where(
      and(
        eq(turnLog.personId, ctx.person.id),
        eq(turnLog.channel, ctx.channel),
        isConversationTurn,
      ),
    )
    .orderBy(desc(turnLog.createdAt))
    .limit(1);
  return last?.injected ?? [];
}

async function compareLast(ctx: CommandContext): Promise<CommandResult> {
  if (!ctx.person.memoryEnabled) {
    return sentence("Memory is off, so my answers already use none. /memory on turns it back on.");
  }
  const used = (await lastAnswerMemories(ctx)).length;
  if (used === 0) {
    return sentence(
      "My last answer used no memory, so without it I would say the same. Ask me something you have told me about, then /compare.",
    );
  }
  const messages = ctx.conversationId
    ? throughLastQuestion(await modelMessages(ctx.conversationId))
    : null;
  if (!messages) return sentence("Ask me something first, then /compare.");
  const answer = await answerWithoutMemory({
    model,
    port: await portFor(ctx.person, ctx.channel),
    messages,
    channel: ctx.channel,
    userHandle: ctx.person.displayName ?? ctx.channel,
  });
  return compareView(answer, used);
}

async function proof(ctx: CommandContext): Promise<CommandResult> {
  const injected = await lastAnswerMemories(ctx);
  return proofView(
    injected.map((item) => ({
      type: item.type ?? "memory",
      distance: item.distance,
      blobId: item.blobId,
    })),
  );
}

/** Returns null when the text is not a command, so the adapter runs the model. */
export async function handleCommand(
  ctx: CommandContext,
  text: string,
): Promise<CommandResult | null> {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const [rawCmd = "", ...rest] = trimmed.slice(1).split(/\s+/);
  const cmd = rawCmd.toLowerCase();
  const arg = rest.join(" ");

  switch (cmd) {
    case "start":
      return welcomeView(env.SURVEY_URL);
    case "help":
      return helpView();
    case "privacy":
      return privacyView();
    case "whoami":
      return whoami(ctx);
    case "link":
      return link(ctx, arg);
    case "proof":
      return proof(ctx);
    case "compare":
      return compareLast(ctx);
    case "export":
      return exportMemories(ctx);
    case "connect":
      return ctx.person.mode === "owned"
        ? sentence(
            "You already own this memory. /whoami shows the account, /disconnect revokes me.",
          )
        : connectLinkView(await ctx.connectUrl("connect"));
    case "disconnect":
      return ctx.person.mode === "owned"
        ? disconnectLinkView(await ctx.connectUrl("disconnect"))
        : sentence("Nothing to revoke: you are in guest mode.");
    case "memory": {
      const [sub = "", ...subRest] = arg.split(/\s+/);
      switch (sub.toLowerCase()) {
        case "":
          return listMemories(ctx);
        case "search":
          return searchMemories(ctx, subRest.join(" "));
        case "on":
          return setMemory(ctx, true);
        case "off":
          return setMemory(ctx, false);
        case "forget": {
          const target = subRest.join(" ").trim();
          if (!target) return forgetUsageView();
          return target.toLowerCase() === "all" ? forget(ctx) : hideOne(ctx, target, true);
        }
        case "unhide":
          return hideOne(ctx, subRest.join(" "), false);
        default:
          return searchMemories(ctx, arg);
      }
    }
    default:
      return helpView(true);
  }
}

export const MEMORY_TYPE_LIST = MEMORY_TYPES.join(", ");
