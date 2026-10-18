/**
 * The owned-mode handshake. The browser does the wallet work; this decides
 * whether it really happened by reading the account on chain.
 */
import {
  channelIdentities,
  connectTokens,
  delegateKeys,
  eq,
  memoryIndex,
  people,
  sql,
} from "@remora/db";
import { createSuiClient, fetchRelayerConfig, readAccount } from "@remora/memory";
import { Hono } from "hono";
import { z } from "zod";
import { loadToken } from "../connect/tokens.ts";
import { db } from "../context.ts";
import { env } from "../env/load.ts";
import { mergePersons, personByWallet } from "../identity/persons.ts";

const doneBody = z.object({
  accountId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  digest: z.string().nullish(),
});

const sui = createSuiClient(env.SUI_NETWORK);

/**
 * The landing page's numbers, cached.
 *
 * Counted the same way `bun run evidence` counts them: only `stored` rows, because
 * a pending write is not yet a blob on Walrus and a failed one never will be.
 * Claiming otherwise on the front page would be the cheapest possible lie and
 * the easiest to check.
 */
let statsCache: { at: number; body: unknown } | null = null;
const STATS_TTL_MS = 60_000;

export const connectRoutes = new Hono()
  .get("/api/stats", async (c) => {
    if (statsCache && Date.now() - statsCache.at < STATS_TTL_MS) {
      return c.json(statsCache.body as Record<string, unknown>);
    }
    const [row] = await db
      .select({
        stored: sql<number>`count(*) filter (where ${memoryIndex.status} = 'stored')::int`,
        people: sql<number>`count(distinct ${memoryIndex.personId})::int`,
      })
      .from(memoryIndex);
    const body = {
      memories: row?.stored ?? 0,
      people: row?.people ?? 0,
      accountId: env.MEMWAL_ACCOUNT_ID,
      network: env.SUI_NETWORK,
    };
    statsCache = { at: Date.now(), body };
    return c.json(body);
  })
  /**
   * Deployment parameters the web app needs. The package is upgradeable, so it
   * is read live.
   *
   * `operatorAccountId` is hippo's own Walrus Memory account, where guest
   * memories live until a user connects a wallet. It is a shared object on a
   * public chain and the submission form asks for it, so publishing it here
   * costs nothing and lets the landing page link to the real thing rather than
   * asking people to take the claim on faith.
   */
  .get("/api/config", async (c) => {
    const cfg = await fetchRelayerConfig(env.MEMWAL_SERVER_URL).catch(() => null);
    return c.json({
      network: env.SUI_NETWORK,
      relayerUrl: env.MEMWAL_SERVER_URL,
      packageId: cfg?.packageId ?? env.MEMWAL_PACKAGE_ID,
      registryId: env.MEMWAL_REGISTRY_ID,
      operatorAccountId: env.MEMWAL_ACCOUNT_ID,
    });
  })

  /** What the connect page needs to render, without leaking anything secret. */
  .get("/api/connect/:token", async (c) => {
    const row = await loadToken(c.req.param("token"));
    if (!row) return c.json({ error: "This link has expired. Run /connect again." }, 404);
    const [key] = row.delegateKeyId
      ? await db.select().from(delegateKeys).where(eq(delegateKeys.id, row.delegateKeyId)).limit(1)
      : [];
    if (!key) return c.json({ error: "No delegate key on this link." }, 404);
    const [person] = await db.select().from(people).where(eq(people.id, row.personId)).limit(1);
    return c.json({
      kind: row.kind,
      publicKey: key.publicKeyHex,
      label: key.label,
      expiresAt: row.expiresAt,
      accountId: person?.accountId ?? null,
    });
  })

  /**
   * The browser says the transaction landed. Verify on chain before believing it:
   * a forged callback must not be able to flip a person into owned mode.
   */
  .post("/api/connect/:token/done", async (c) => {
    const row = await loadToken(c.req.param("token"));
    if (!row) return c.json({ error: "This link has expired." }, 404);
    const parsed = doneBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "accountId missing or malformed." }, 400);
    const body = parsed.data;
    const [key] = row.delegateKeyId
      ? await db.select().from(delegateKeys).where(eq(delegateKeys.id, row.delegateKeyId)).limit(1)
      : [];
    if (!key) return c.json({ error: "No delegate key on this link." }, 404);

    /**
     * Read the account off chain and take BOTH facts from it: whether our
     * delegate key is registered, and who owns it.
     *
     * The wallet address must never come from the request body. A caller who
     * completes the flow honestly with their own account still controls what
     * they POST here, and an attacker-supplied `walletAddress` belonging to
     * someone else would merge that victim's person into the attacker's
     * session, handing over the victim's delegate key and memories. The
     * on-chain owner cannot be forged.
     */
    const account = await readAccount(sui, body.accountId);
    const wantedKey = key.publicKeyHex.toLowerCase().replace(/^0x/, "");
    const registered =
      account?.active === true && account.delegates.some((d) => d.publicKeyHex === wantedKey);
    const walletAddress = account?.owner ?? null;

    if (row.kind === "connect") {
      if (!registered) {
        return c.json(
          {
            error:
              "That account does not list hippo's delegate key yet. Give the transaction a moment, then retry.",
          },
          409,
        );
      }
      // If this wallet already belongs to a person from another channel, this is
      // the same human arriving by a second route: fold the two together so the
      // memory follows them rather than splitting in half.
      let personId = row.personId;
      if (walletAddress) {
        const existing = await personByWallet(walletAddress);
        if (existing && existing.id !== personId) {
          await mergePersons(existing.id, personId);
          personId = existing.id;
        }
      }

      await db.transaction(async (tx) => {
        await tx
          .update(delegateKeys)
          .set({ status: "active", addTxDigest: body.digest ?? null })
          .where(eq(delegateKeys.id, key.id));
        // `personId` here, never `row.personId`: the merge above may have
        // folded this person into an existing one and deleted the old row, so
        // updating by the original id would silently match nothing and leave
        // the user in guest mode.
        await tx
          .update(people)
          .set({ mode: "owned", accountId: body.accountId, walletAddress })
          .where(eq(people.id, personId));
        if (walletAddress) {
          await tx
            .insert(channelIdentities)
            .values({
              personId,
              channel: "wallet",
              externalId: walletAddress.toLowerCase(),
            })
            .onConflictDoNothing();
        }
        await tx
          .update(connectTokens)
          .set({ usedAt: new Date() })
          .where(eq(connectTokens.token, row.token));
      });
      return c.json({ ok: true, mode: "owned", accountId: body.accountId });
    }

    // Disconnect: the key must be gone from the account before we stand down.
    if (registered) {
      return c.json(
        {
          error:
            "hippo's key is still registered on that account. Give the transaction a moment, then retry.",
        },
        409,
      );
    }
    await db.transaction(async (tx) => {
      // Destroy our copy of the credential, not just the flag on it. Removing
      // the key on chain does end relayer access, but not instantly: measured
      // at about 32 seconds, still accepted at 15
      // (docs/evidence/revocation-2026-09-22.md). Not possessing the key closes
      // that window on our side at once, and costs nothing to keep.
      await tx
        .update(delegateKeys)
        .set({
          status: "revoked",
          privateKeyEnc: "",
          removeTxDigest: body.digest ?? null,
          revokedAt: new Date(),
        })
        .where(eq(delegateKeys.id, key.id));
      await tx.update(people).set({ mode: "guest" }).where(eq(people.id, row.personId));
      await tx
        .update(connectTokens)
        .set({ usedAt: new Date() })
        .where(eq(connectTokens.token, row.token));
    });
    return c.json({ ok: true, mode: "guest" });
  });
