/** F14 against the local dev database (skipped without one, like the runtime tests). */
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { approvals, createDb, eq, inArray, mcpTokens, remoras, sentinelRules } from "@remora/db";
import { loadEnv } from "@remora/memory";
import { afterAll, describe, expect, it } from "vitest";
import type { RuntimeDeps } from "../runtime/deps.ts";
import { approveYes } from "../runtime/schedules.ts";
import {
  authenticate,
  callsOf,
  createToken,
  listTokens,
  recordCall,
  revokeToken,
  secretHash,
} from "./tokens.ts";

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;
const OWNER = normalizeSuiAddress(`0x0e${process.pid.toString(16)}`);

describe.skipIf(!local)("MCP tokens in Postgres (F14)", () => {
  const db = createDb(local as string);
  const made: string[] = [];
  const remora = async (template: "scout" | "sentinel") => {
    const [r] = await db
      .insert(remoras)
      .values({
        ownerAddress: OWNER,
        network: "testnet",
        template,
        name: `${template} ${process.pid}`,
        config: {},
        status: "active",
        address: normalizeSuiAddress("0x5c"),
      })
      .returning();
    if (!r) throw new Error("no remora");
    made.push(r.id);
    return r;
  };
  afterAll(async () => {
    if (made.length) await db.delete(remoras).where(inArray(remoras.id, made));
  });

  it("stores only the hash, and lives until revoked or expired", async () => {
    const r = await remora("scout");
    const { row, secret } = await createToken(db, {
      remoraId: r.id,
      owner: OWNER,
      name: "Claude Code",
      scopes: ["memory:read", "pay"],
    });
    const [stored] = await db.select().from(mcpTokens).where(eq(mcpTokens.id, row.id));
    expect(stored?.secretSha256).toBe(secretHash(secret));
    expect(JSON.stringify(stored)).not.toContain(secret);
    expect(stored?.client).toBe("claude-code");

    const ok = await authenticate(db, secret);
    expect(ok.ok && ok.token.id).toBe(row.id);
    expect((await authenticate(db, `${secret}x`)).ok).toBe(false);
    expect(await authenticate(db, undefined)).toEqual({ ok: false, reason: "missing" });

    const later = new Date(Date.now() + 31 * 86_400_000);
    expect(await authenticate(db, secret, later)).toEqual({ ok: false, reason: "expired" });

    await revokeToken(db, OWNER, row.id);
    expect(await authenticate(db, secret)).toEqual({ ok: false, reason: "revoked" });
    expect(await revokeToken(db, normalizeSuiAddress("0xbad"), row.id)).toBeNull();
  });

  it("totals calls, spend and memories, and shows calls to the owner only", async () => {
    const r = await remora("scout");
    const { row } = await createToken(db, {
      remoraId: r.id,
      owner: OWNER,
      name: "HTTP script",
      scopes: ["pay"],
    });
    await recordCall(db, row.id, { tool: "pay", ok: true, spend: 10_000n });
    await recordCall(db, row.id, { tool: "pay", ok: false, error: "over the limit" });
    await recordCall(db, row.id, {
      tool: "remora_remember",
      ok: true,
      memoryId: "7e8f9a0b-1c2d-4e3f-8a4b-5c6d7e8f9a0b",
    });
    const [view] = (await listTokens(db, OWNER, "testnet")).filter((t) => t.id === row.id);
    expect(view).toMatchObject({ calls: 3, spend: "10000", memories: 1, scopes: ["pay"] });
    expect(JSON.stringify(view)).not.toContain("secret");
    expect(await callsOf(db, normalizeSuiAddress("0xbad"), row.id)).toBeNull();
    expect((await callsOf(db, OWNER, row.id))?.map((c) => c.tool)).toHaveLength(3);
  });

  it("teaches a rule an agent proposed only when the owner says yes", async () => {
    const r = await remora("sentinel");
    const [a] = await db
      .insert(approvals)
      .values({
        remoraId: r.id,
        network: "testnet",
        kind: "rule",
        summary: "Rule proposed via mcp:claude-code",
        payload: { text: "ignore incoming SUI under 0.01", via: "mcp:claude-code" },
      })
      .returning();
    expect(await db.select().from(sentinelRules).where(eq(sentinelRules.remoraId, r.id))).toEqual(
      [],
    );
    const deps = {
      db,
      log: createLogger({}, () => {}),
      memory: { remember: async () => ({ saved: true, note: "" }), recall: async () => [] },
      brain: { parseRule: async () => ({ rule: null, tokens: 0 }) },
    } as unknown as RuntimeDeps;
    const out = (await approveYes(deps, OWNER, a?.id as string)) as { rule?: { text: string } };
    expect(out.rule?.text).toBe("ignore incoming SUI under 0.01");
    const [after] = await db
      .select()
      .from(approvals)
      .where(eq(approvals.id, a?.id as string));
    expect(after?.status).toBe("approved");
  });
});
