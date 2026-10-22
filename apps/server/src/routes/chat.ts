import { gatherContext, runTurn } from "@remora/core";
import { type CommandTable, packCommandBody } from "@remora/core/command-table";
import { and, delegateKeys, desc, eq, memoryIndex } from "@remora/db";
import { createSuiClient, explorer, readAccount } from "@remora/memory";
import { generateText } from "ai";
import { type Context, Hono } from "hono";
import { setCookie } from "hono/cookie";
import { z } from "zod";
import { citationsOf } from "../chat/citations.ts";
import { type CommandContext, handleCommand } from "../chat/commands.ts";
import { answerWithoutMemory } from "../chat/compare.ts";
import { isGettingToKnow } from "../chat/getting-to-know.ts";
import {
  appendAssistant,
  appendUser,
  claimWebConversation,
  modelMessages,
  modelMessagesThrough,
  openChannelThread,
  recentTurns,
  storedAnswer,
} from "../chat/history.ts";
import { knownMemoryHashes } from "../chat/known-hashes.ts";
import { tooLong } from "../chat/limits.ts";
import { checkRate, noteCommand, noteModelCall } from "../chat/ratelimit.ts";
import { followUpRequest, parseSuggestions } from "../chat/suggestions.ts";
import { startConnect, startDisconnect } from "../connect/tokens.ts";
import { db, model, modelFor } from "../context.ts";
import { describeFailure } from "../copy/index.ts";
import { env } from "../env/load.ts";
import { personFromSession } from "../identity/auth.ts";
import {
  channelHeader,
  GUEST_COOKIE,
  guestCookie,
  guestHeader,
  legacyGuestOnly,
  sessionCookie,
  sessionHeader,
} from "../identity/names.ts";
import {
  hasCorrections,
  knownSoFar,
  logTurn,
  ownMemoryOf,
  type Person,
  portFor,
  resolvePerson,
  setHidden,
} from "../identity/persons.ts";
import { meIdentity } from "../identity/predicates.ts";
import { asDownload, exportFor } from "../memory/export-person.ts";
import { searchResult } from "../memory/search-result.ts";
import { noteRelayerError } from "../ops/signals.ts";
import { listAccount } from "../runtime/inspector.ts";
import { plainReply, textReply } from "./reply.ts";

/** The web page and the CLI share this route; the CLI identifies itself by header. */
const CHANNEL = "web";

/** Reads only. The chain, not the relayer, is the authority on who may read a memory. */
const sui = createSuiClient(env.SUI_NETWORK);

/**
 * Cross-origin fallbacks for the cookies.
 *
 * A `SameSite=Lax` cookie is not sent on a cross-site request, which is what
 * broke production when the page was on vercel.app and the API on railway.app.
 * Proxying fixed that, but it ties the app to a host that can proxy, and the UI
 * is meant to be able to live on Walrus Sites, where it cannot.
 *
 * So a client on a different origin may carry the same opaque id in a header
 * instead. A header is never attached by the browser on its own, so this cannot
 * be used for CSRF: it is strictly safer in that respect than `SameSite=None`,
 * which was the other way to solve it. The trade is that the id lives in
 * `localStorage` rather than an `HttpOnly` cookie, so a cross-site scripting
 * bug on the page could read it. Same-origin deployments keep the cookie and
 * never touch this path.
 */

/** A guest id is opaque, but it must still look like one we would have minted. */
function readGuestId(c: Context): string | undefined {
  const cookie = guestCookie(c);
  if (cookie) return cookie;
  const header = guestHeader(c);
  return header && /^[0-9a-f-]{36}$/i.test(header) ? header : undefined;
}

function readSessionId(c: Context): string | undefined {
  const cookie = sessionCookie(c);
  if (cookie) return cookie;
  const header = sessionHeader(c);
  return header && /^[0-9a-f]{64}$/i.test(header) ? header : undefined;
}
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

/**
 * Who is talking. A wallet session wins over the anonymous cookie, so someone
 * who signed in sees their own memory rather than a fresh stranger's.
 */
async function webPerson(
  c: Context,
  channel: string,
  cookie: string | undefined,
  setId: (id: string) => void,
): Promise<Person> {
  const sessionId = readSessionId(c);
  if (sessionId) {
    const signedIn = await personFromSession(sessionId);
    if (signedIn) return signedIn;
  }
  const id = cookie ?? crypto.randomUUID();
  // A guest still on the hippo cookie moves to the Remora one (ADR-0044).
  if (!cookie || legacyGuestOnly(c)) setId(id);
  return resolvePerson(channel, id, channel);
}

const chatBody = z.object({
  text: z.string().trim().min(1),
  conversationId: z.uuid().optional(),
  clientMessageId: z.string().trim().min(1).max(128).optional(),
  regenerate: z.boolean().optional(),
  /** A `MODEL_CATALOG` id from the composer's picker; anything else runs on the default (D9). */
  model: z.string().max(120).optional(),
});

const compareBody = z.object({
  conversationId: z.uuid(),
  messageId: z.string().trim().min(1).max(128),
});

const UNSAVED = "I could not save that message, so I did not answer. Try again.";

const visibilityBody = z.object({
  blobId: z.string().min(1),
  hidden: z.boolean(),
});

function spokenText(
  out: Array<{ role: string; parts: Array<{ type: string; text?: string }> }>,
): string {
  const last = [...out].reverse().find((m) => m.role === "assistant");
  if (!last) return "";
  return last.parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

/**
 * The person an `/api/me` request is about, or null when it identifies nobody.
 * A session header that does not resolve no longer counts: it used to let the
 * request through and mint a new person for it (see `meIdentity`).
 */
export async function mePerson(c: Context): Promise<Person | null> {
  const sessionId = readSessionId(c);
  const sessionPerson = sessionId ? await personFromSession(sessionId) : null;
  const guestId = readGuestId(c);
  switch (meIdentity(Boolean(sessionPerson), guestId)) {
    case "session":
      return sessionPerson;
    case "guest":
      return resolvePerson(CHANNEL, guestId as string, CHANNEL);
    case "none":
      return null;
  }
}

export const chatRoutes = new Hono()
  .post("/api/chat", async (c) => {
    const parsed = chatBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Send a message to continue." }, 400);
    const body = parsed.data;
    const channel = channelHeader(c) === "cli" ? "cli" : CHANNEL;
    const person = await webPerson(c, channel, readGuestId(c), (id) =>
      setCookie(c, GUEST_COOKIE, id, {
        httpOnly: true,
        sameSite: "Lax",
        secure: env.WEB_BASE_URL.startsWith("https"),
        path: "/",
        maxAge: COOKIE_MAX_AGE,
      }),
    );

    const text = body.text;
    const oversize = tooLong(text);
    if (oversize) return plainReply(channel, oversize);

    const ctx: CommandContext = {
      person,
      channel,
      connectUrl: async (kind) =>
        kind === "connect"
          ? (await startConnect(person, channel, person.displayName ?? channel)).url
          : (await startDisconnect(person)).url,
    };
    // Commands are rate limited too. They are the cheapest thing to flood and
    // the most expensive to serve: /connect mints a keypair and two rows,
    // /memory search spends the shared relayer budget.
    const gate = await checkRate(person.id);
    if (!gate.allowed) return plainReply(channel, gate.message);

    let conversationId: string;
    try {
      if (channel === "web") {
        if (!body.conversationId) return c.json({ error: "Send a message to continue." }, 400);
        const owned = await claimWebConversation(person.id, body.conversationId);
        if (!owned) return c.json({ error: "That chat is gone." }, 404);
        conversationId = body.conversationId;
      } else {
        conversationId = await openChannelThread({
          personId: person.id,
          channel,
          threadKey: "cli",
        });
      }
    } catch (err) {
      console.error(`[${channel}] history`, err);
      return plainReply(channel, UNSAVED);
    }

    if (body.clientMessageId && !body.regenerate) {
      const prior = await storedAnswer(conversationId, body.clientMessageId);
      if (prior) {
        return prior.kind === "command"
          ? plainReply(channel, prior.text, undefined, channel === "web" ? prior.table : undefined)
          : textReply(prior.text);
      }
    }

    const command = await handleCommand({ ...ctx, conversationId }, text);
    if (command) {
      const saved = await appendUser({
        conversationId,
        personId: person.id,
        text,
        kind: "command",
        clientId: body.clientMessageId,
        regenerate: body.regenerate,
      }).catch((err) => {
        console.error(`[${channel}] history`, err);
        return null;
      });
      if (saved?.ok && !saved.alreadyAnswered) {
        const body =
          channel === "web" && command.table
            ? packCommandBody(command.text, command.table)
            : command.text;
        await appendAssistant(conversationId, body, "command").catch((err) =>
          console.error(`[${channel}] history`, err),
        );
      }
      await noteCommand(person.id, channel);
      const replay = saved?.ok && saved.alreadyAnswered && saved.answer ? saved : null;
      const shown = replay?.answer ?? command.text;
      const table: CommandTable | undefined = replay ? replay.table : command.table;
      return plainReply(channel, shown, command.files, channel === "web" ? table : undefined);
    }

    let placed: Awaited<ReturnType<typeof appendUser>>;
    try {
      placed = await appendUser({
        conversationId,
        personId: person.id,
        text,
        kind: "turn",
        clientId: body.clientMessageId,
        regenerate: body.regenerate,
      });
    } catch (err) {
      console.error(`[${channel}] history`, err);
      return plainReply(channel, UNSAVED);
    }
    if (!placed.ok) return plainReply(channel, UNSAVED);
    if (placed.alreadyAnswered) return textReply(placed.answer ?? "…");

    const port = await portFor(person, channel);
    const messages = await modelMessages(conversationId);
    const knownHashes =
      body.regenerate && placed.userSince
        ? await knownMemoryHashes(person.id, placed.userSince)
        : undefined;
    const chosenModel = modelFor(body.model);
    const input = {
      model: chosenModel,
      port,
      messages,
      channel,
      userHandle: person.displayName ?? "web",
      memoryEnabled: person.memoryEnabled,
      sessionStart: placed.sessionStart,
      hasCorrections: await hasCorrections(person.id),
      gettingToKnow: person.memoryEnabled && isGettingToKnow(await knownSoFar(person.id)),
      abortSignal: c.req.raw.signal,
      knownHashes,
    };
    const turnCtx = await gatherContext(input);
    if (c.req.raw.signal.aborted) return c.body(null, 204);
    const result = runTurn(input, turnCtx);
    return result.toUIMessageStreamResponse({
      /**
       * The page shows this in a toast. Without it the AI SDK sends its own
       * default, which is the word "error", and a person watching a chat go
       * quiet learns nothing from that. Same sentences as every other channel.
       */
      onError: (err) => {
        console.error("[web] stream failed", err);
        return describeFailure(err);
      },
      /**
       * Tell the page what this answer was built from. Judging criterion one is
       * whether memory is doing real work, and a user cannot see that from the
       * text alone: the bot just sounds like it knows them. Sending the recalled
       * memories with the reply makes it visible in the moment rather than only
       * through `/proof` afterwards.
       */
      messageMetadata: ({ part }) =>
        part.type === "start"
          ? {
              recalled: turnCtx.injected.map((m) => ({
                type: m.parsed?.type ?? "memory",
                text: m.parsed?.text ?? m.text,
                relevance: Number((1 - m.distance).toFixed(2)),
                blobId: m.blob_id,
              })),
            }
          : undefined,
      onFinish: async ({ messages: out }) => {
        const writes = out.flatMap((m) => m.parts).filter((p) => p.type === "tool-remember").length;
        await appendAssistant(
          conversationId,
          spokenText(out),
          "turn",
          citationsOf(turnCtx.injected),
        ).catch((e) => console.error(`[${channel}] history`, e));
        await logTurn(person, channel, turnCtx, writes, chosenModel.id).catch((e) =>
          console.error("[web] logTurn", e),
        );
      },
    });
  })
  .post("/api/chat/suggestions", async (c) => {
    const parsed = z
      .object({ conversationId: z.uuid() })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ suggestions: [] }, 400);
    const person = await mePerson(c);
    if (!person) return c.json({ suggestions: [] }, 401);
    const gate = await checkRate(person.id);
    if (!gate.allowed) return c.json({ suggestions: [], message: gate.message });
    const lines = await recentTurns(person.id, parsed.data.conversationId, 8);
    if (!lines) return c.json({ suggestions: [] }, 404);
    if (lines.length === 0) return c.json({ suggestions: [] });
    const request = followUpRequest(lines);
    let suggestions: string[] = [];
    try {
      const result = await generateText({
        model: model.primary,
        system: request.system,
        prompt: request.prompt,
      });
      suggestions = parseSuggestions(result.text);
    } catch (err) {
      console.error("[suggestions]", err instanceof Error ? err.name : "error");
    }
    await noteModelCall(person.id, CHANNEL, "suggestion", model.id);
    return c.json({ suggestions });
  })
  .post("/api/chat/compare", async (c) => {
    const parsed = compareBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Pick an answer to compare." }, 400);
    const person = await mePerson(c);
    if (!person) return c.json({ error: "Say something in the chat first." }, 401);
    const gate = await checkRate(person.id);
    if (!gate.allowed) return c.json({ error: gate.message }, 429);
    const messages = await modelMessagesThrough(
      person.id,
      parsed.data.conversationId,
      parsed.data.messageId,
    );
    if (!messages) return c.json({ error: "That message is not in this chat any more." }, 404);
    await noteModelCall(person.id, CHANNEL, "compare", model.id);
    try {
      const text = await answerWithoutMemory({
        model,
        port: await portFor(person, CHANNEL),
        messages,
        channel: CHANNEL,
        userHandle: person.displayName ?? "web",
        abortSignal: c.req.raw.signal,
      });
      return c.json({ text });
    } catch (err) {
      console.error("[compare]", err instanceof Error ? err.name : "error");
      return c.json({ error: describeFailure(err) }, 502);
    }
  })

  /** The memories hippo wrote for this person, newest first, with links and expiry. */
  .get("/api/me/memories", async (c) => {
    const person = await mePerson(c);
    if (!person) return c.json({ memories: [] });
    const rows = await db
      .select()
      .from(memoryIndex)
      .where(ownMemoryOf(person.id))
      .orderBy(desc(memoryIndex.createdAt))
      .limit(100);

    /**
     * Storage on Walrus is paid per epoch, so a memory is not kept forever.
     * The read API carries `expires_at` per blob, and telling the user when
     * their memory runs out is more honest than implying it never does.
     * Best-effort: the relayer's metadata routes are flaky, so a failure here
     * costs the expiry column and nothing else.
     */
    const port = await portFor(person, CHANNEL);
    const expiry = new Map<string, string>();
    try {
      // Every page asks for this (useMe), so the listing is shared for minutes: expiry changes rarely,
      // and the account's relayer budget is about 1000 weighted requests an hour (ADR-0049).
      for (const m of await listAccount(port.scope, { maxAgeMs: 300_000 })) {
        if (m.expires_at) expiry.set(m.blob_id, m.expires_at);
      }
    } catch (e) {
      noteRelayerError(e);
      console.warn("[web] expiry lookup failed", e instanceof Error ? e.message : e);
    }

    return c.json({
      memories: rows.map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        channel: r.channel,
        createdAt: r.createdAt,
        blobId: r.blobId,
        expiresAt: r.blobId ? (expiry.get(r.blobId) ?? null) : null,
        // The ciphertext is public; only this account can read it. That is the
        // point, so both links are offered.
        ciphertextUrl: r.blobId ? explorer.blob(r.blobId) : null,
        explorerUrl: r.blobId ? explorer.blobExplorer(r.blobId) : null,
        hidden: Boolean(r.hiddenAt),
        // Which account sealed it decides whose wallet can open it, and the
        // hash lets the browser check what it decrypted against what hippo wrote.
        accountId: r.accountId,
        textSha256: r.textSha256,
      })),
    });
  })

  /**
   * Stop using one memory, or start again: `/memory forget <blob>` and
   * `/memory unhide <blob>` for the page. Only the person's own memories match.
   */
  .post("/api/me/memories/visibility", async (c) => {
    const person = await mePerson(c);
    if (!person) return c.json({ error: "Say something first." }, 401);
    const parsed = visibilityBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "blobId and hidden are required." }, 400);
    const body = parsed.data;
    const gate = await checkRate(person.id);
    if (!gate.allowed) return c.json({ error: gate.message }, 429);
    await noteCommand(person.id, CHANNEL);
    const out = await setHidden(person.id, body.blobId, body.hidden);
    if (out.kind !== "done") return c.json({ error: "No memory of yours has that blob." }, 404);
    return c.json({ blobId: out.blobId, hidden: body.hidden });
  })

  /**
   * The account holding this person's memory, read from chain rather than from
   * our own database.
   *
   * The whole claim of this project is that access is a fact on Sui and not a
   * promise from hippo. A page that showed our `delegate_keys` table would be
   * showing hippo's word for it. This reads the object, so the delegate list a
   * user is about to revoke is the one that actually governs access, and a
   * disagreement between the two is visible rather than hidden.
   */
  .get("/api/me/account", async (c) => {
    const person = await mePerson(c);
    if (!person) return c.json({ account: null });
    const owned = person.mode === "owned";
    // In guest mode the memory sits in hippo's own account, which is a real
    // object with real delegates. Saying so is more honest than showing nothing
    // until someone connects a wallet.
    const accountId = owned ? person.accountId : env.MEMWAL_ACCOUNT_ID;
    if (!accountId) return c.json({ account: null });

    const account = await readAccount(sui, accountId).catch(() => null);
    if (!account) {
      return c.json({
        account: { accountId, explorerUrl: explorer.object(accountId), unreadable: true },
      });
    }

    // Which entry is the key hippo holds for this person. Only meaningful in
    // owned mode; in guest mode every key on the account belongs to hippo.
    const [ours] = owned
      ? await db
          .select({ publicKeyHex: delegateKeys.publicKeyHex })
          .from(delegateKeys)
          .where(and(eq(delegateKeys.personId, person.id), eq(delegateKeys.status, "active")))
          .limit(1)
      : [];
    const mine = ours?.publicKeyHex?.toLowerCase().replace(/^0x/, "");

    return c.json({
      account: {
        accountId,
        explorerUrl: explorer.object(accountId),
        owner: account.owner,
        ownerUrl: account.owner ? explorer.address(account.owner) : null,
        active: account.active,
        yours: owned,
        delegates: account.delegates.map((d) => ({
          label: d.label,
          publicKeyHex: d.publicKeyHex,
          suiAddress: d.suiAddress,
          isHippo: mine !== undefined && d.publicKeyHex === mine,
        })),
      },
    });
  })

  /**
   * Read memories back by meaning, the same thing `/memory search` does.
   *
   * The page cannot search its own list: memory text is never stored in
   * Postgres, only blob ids and dates, so the text has to come back from Walrus
   * through a recall. That spends the shared relayer budget, so it is rate
   * limited exactly like the command.
   */
  .get("/api/me/search", async (c) => {
    const query = (c.req.query("q") ?? "").trim();
    if (!query) return c.json({ results: [] });
    const person = await mePerson(c);
    if (!person) return c.json({ results: [] });

    const gate = await checkRate(person.id);
    if (!gate.allowed) return c.json({ error: gate.message }, 429);
    await noteCommand(person.id, CHANNEL);

    const port = await portFor(person, CHANNEL);
    const hits = await port.recall({ query, limit: 8, maxDistance: 0.9 }).catch(() => null);
    if (hits === null) {
      return c.json({ error: "Walrus Memory could not be reached just now." }, 502);
    }
    // Recall also reads the team's memory. Mark what is this person's own, so
    // the page offers to hide only that: a team fact is not theirs to hide, and
    // the button failed with a 404 on it.
    const own = new Set(
      (
        await db
          .select({ blobId: memoryIndex.blobId })
          .from(memoryIndex)
          .where(ownMemoryOf(person.id))
      ).flatMap((r) => (r.blobId ? [r.blobId] : [])),
    );
    return c.json({ results: hits.map((hit) => searchResult(hit, own)) });
  })

  /**
   * The same export `/export` produces, as a download for the button on /me.
   *
   * Built per request and never cached: the text in it comes back from Walrus
   * and must not land in Postgres or anywhere else we keep. It spends the shared
   * relayer budget on up to six recalls, so it is rate limited like a command.
   */
  .get("/api/me/export", async (c) => {
    const format = c.req.query("format") === "md" ? "md" : "json";
    const person = await mePerson(c);
    if (!person) return c.json({ error: "Say something first." }, 401);

    const gate = await checkRate(person.id);
    if (!gate.allowed) return c.json({ error: gate.message }, 429);
    await noteCommand(person.id, CHANNEL);

    const file = asDownload(await exportFor(person, CHANNEL), format);
    return c.body(file.content, 200, {
      "content-type": file.mime,
      "content-disposition": `attachment; filename="${file.name}"`,
      "cache-control": "no-store",
    });
  })

  /**
   * Start connect or disconnect from the page rather than the chat.
   *
   * Both mint rows and `connect` mints a keypair, so they cost the same as the
   * slash commands and go through the same rate limit.
   */
  .post("/api/me/:kind{connect|disconnect}", async (c) => {
    const kind = c.req.param("kind") as "connect" | "disconnect";
    const person = await mePerson(c);
    if (!person) return c.json({ error: "Say something first." }, 401);

    if (kind === "disconnect" && person.mode !== "owned") {
      return c.json({ error: "hippo does not hold a key for you to revoke." }, 409);
    }
    const gate = await checkRate(person.id);
    if (!gate.allowed) return c.json({ error: gate.message }, 429);
    await noteCommand(person.id, CHANNEL);

    const started =
      kind === "connect"
        ? await startConnect(person, CHANNEL, person.displayName ?? CHANNEL)
        : await startDisconnect(person);
    return c.json({ url: started.url });
  })

  /** Everything the /me page shows. */
  .get("/api/me", async (c) => {
    const cookie = readGuestId(c);
    const sessionId = readSessionId(c);
    // `signedIn` has to mean the session resolved, not that a cookie was sent.
    // A signed-out or expired session leaves the cookie in the browser, and
    // reporting that as signed in would show the wrong thing on /me.
    const sessionPerson = sessionId ? await personFromSession(sessionId) : null;
    if (!cookie && !sessionPerson) return c.json({ mode: "anonymous" as const });
    const person = sessionPerson ?? (await webPerson(c, CHANNEL, cookie, () => {}));
    const signedIn = Boolean(sessionPerson);
    const port = await portFor(person, CHANNEL);
    return c.json({
      mode: person.mode,
      signedIn,
      personId: person.id,
      memoryEnabled: person.memoryEnabled,
      accountId: person.accountId,
      walletAddress: person.walletAddress,
      namespace: port.scope.namespace,
      surveyUrl: env.SURVEY_URL ?? null,
    });
  });
