/**
 * B1/B3/B7/B8/B9 (be): remora lifecycle. The server builds every owner transaction unsigned; the
 * owner's wallet signs and executes it; the server then confirms from the chain, by digest, before it
 * changes any state. A remora's key comes from B4, its money is its Disc (ADR-0025).
 */
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import type { Logger, SuiNetwork } from "@remora/chain";
import { and, type Db, desc, eq, gt, remoraEvents, remoras } from "@remora/db";
import {
  AllowanceCapBcs,
  addIssue,
  buildIssue,
  buildPause,
  buildRevoke,
  buildRevokeAndReissue,
  buildRotate,
  type DiscConfig,
  getAllowance,
  getDisc,
  type IssueArgs,
} from "@remora/disc-sdk";
import { type Budget, isCatalogModel, RemoraConfig } from "@remora/schema";
import type { RemoraSigner } from "@remora/signer";
import type { Networks } from "../money/networks.ts";
import { type ResolvedReef, reefRef } from "../money/reef.ts";
import { isTemplateSlug, TEMPLATES, type TemplateSlug } from "../templates/index.ts";

export type Remora = typeof remoras.$inferSelect;

export class RemoraError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

export interface RemoraDeps {
  db: Db;
  networks: Networks;
  signer: RemoraSigner;
  reef: (network: SuiNetwork) => ResolvedReef[];
  log: Logger;
  now?: () => Date;
  /** Shadow mode length (N3); 24 h in the spec. */
  shadowMs?: number;
  /** Reads of an owner transaction before giving up (1.5 s apart); the wallet's node can be ahead. */
  txReadAttempts?: number;
}

/** Testnet-sized defaults; the owner can change them before signing (B7 later). */
export function defaultBudget(slug: TemplateSlug, coinType: string): Budget | null {
  if (slug !== "scout") return null;
  return {
    coinType,
    windowLimit: "1000000",
    window: "month",
    perPaymentCap: "50000",
    payees: [...TEMPLATES.scout.payees],
  };
}

const MONTH_MS = 31 * 24 * 3600_000;

/** Budget → Disc issue arguments: a monthly rate limit, a 12-month lifetime cap, expiry in a year. */
export function issueArgs(
  name: string,
  spender: string,
  budget: Budget,
  reef: ResolvedReef[],
  now: Date,
): IssueArgs {
  const payees = [
    ...new Set(
      budget.payees.map((ref) => {
        const hit = reef.find((r) => r.ref === ref);
        if (!hit)
          throw new RemoraError("reef.unknown_payee", `${ref} isn't in the Reef on this network.`);
        return normalizeSuiAddress(hit.payTo);
      }),
    ),
  ];
  const window = BigInt(budget.windowLimit);
  return {
    name,
    spender,
    lifetimeCap: window * 12n,
    expiryMs: budget.expiresAt ? Date.parse(budget.expiresAt) : now.getTime() + 12 * MONTH_MS,
    rateLimit: { months: 1, limit: window },
    payees,
    perPaymentCap: BigInt(budget.perPaymentCap),
  };
}

const createdOf = (
  tx: {
    effects?: { changedObjects: { objectId: string; idOperation: string }[] } | null;
    objectTypes?: Record<string, string>;
  },
  re: RegExp,
) =>
  tx.effects?.changedObjects.find(
    (o) => o.idOperation === "Created" && re.test(tx.objectTypes?.[o.objectId] ?? ""),
  )?.objectId ?? null;

export interface CreateInput {
  owner: string;
  network: SuiNetwork;
  template: string;
  name?: string;
  budget?: Budget | null;
  watch?: string[];
}

export function createRemoraService(deps: RemoraDeps) {
  const now = deps.now ?? (() => new Date());
  const { db } = deps;

  const discCfg = (network: SuiNetwork): DiscConfig => {
    const c = deps.networks.config(network);
    if (!c.available || !c.packageId || !c.discRegistryId) {
      throw new RemoraError("network.unavailable", `${network} isn't available.`);
    }
    return { packageId: c.packageId, registryId: c.discRegistryId, coinType: c.usdcCoinType };
  };

  async function mine(id: string, owner: string): Promise<Remora> {
    const [r] = await db.select().from(remoras).where(eq(remoras.id, id));
    if (!r) throw new RemoraError("remora.not_found", "No such remora.", 404);
    if (normalizeSuiAddress(r.ownerAddress) !== normalizeSuiAddress(owner)) {
      throw new RemoraError("remora.not_owner", "That remora isn't yours.", 403);
    }
    return r;
  }

  async function event(
    r: Remora,
    type: string,
    summary: string,
    payload: Record<string, unknown> = {},
  ) {
    const [e] = await db
      .insert(remoraEvents)
      .values({ remoraId: r.id, network: r.network, type, summary, payload })
      .returning();
    return e;
  }

  async function setRow(id: string, patch: Partial<typeof remoras.$inferInsert>) {
    const [r] = await db
      .update(remoras)
      .set({ ...patch, updatedAt: now() })
      .where(eq(remoras.id, id))
      .returning();
    if (!r) throw new RemoraError("remora.not_found", "No such remora.", 404);
    return r;
  }

  /** Reads an owner transaction by digest and checks the owner sent it and it succeeded. */
  async function ownerTx(r: Remora, digest: string) {
    const client: SuiGrpcClient = deps.networks.client(r.network);
    // The wallet executes through another fullnode; Tatum can be a few seconds behind it.
    const read = () =>
      client.core.getTransaction({
        digest,
        include: { effects: true, objectTypes: true, transaction: true },
      });
    let res: Awaited<ReturnType<typeof read>> | undefined;
    for (let attempt = 0; ; attempt++) {
      try {
        res = await read();
        break;
      } catch (err) {
        if (
          attempt >= (deps.txReadAttempts ?? 12) - 1 ||
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
    if (sender !== normalizeSuiAddress(r.ownerAddress)) {
      throw new RemoraError("tx.not_owner", "That transaction wasn't sent by the owner.", 403);
    }
    return tx;
  }

  /** N5: at the last 7 days' pace, when the current window's budget runs out (null: not this window). */
  async function forecast(r: Remora, window: { limit: bigint; spent: bigint } | null) {
    if (!window) return null;
    const since = new Date(now().getTime() - 7 * 86_400_000);
    const rows = await db
      .select({ payload: remoraEvents.payload })
      .from(remoraEvents)
      .where(
        and(
          eq(remoraEvents.remoraId, r.id),
          eq(remoraEvents.type, "payment"),
          gt(remoraEvents.createdAt, since),
        ),
      );
    const spent7 = rows.reduce(
      (s, x) => s + BigInt(String((x.payload as { amount?: string }).amount ?? 0)),
      0n,
    );
    const perDay = Number(spent7) / 7;
    const left = Number(window.limit - window.spent);
    if (perDay <= 0) return { perDay: "0", runsOutOn: null };
    return {
      perDay: Math.round(perDay).toString(),
      runsOutOn: new Date(now().getTime() + (left / perDay) * 86_400_000)
        .toISOString()
        .slice(0, 10),
    };
  }

  /**
   * The Disc, allowance and cap this remora's issue created. A team import issues several Discs in
   * one transaction (ADR-0042), so each is matched by the remora's Disc name, not taken first.
   */
  async function issuedFor(r: Remora, tx: Awaited<ReturnType<typeof ownerTx>>) {
    const core = deps.networks.client(r.network).core;
    const created = (re: RegExp) =>
      (tx.effects?.changedObjects ?? [])
        .filter((o) => o.idOperation === "Created" && re.test(tx.objectTypes?.[o.objectId] ?? ""))
        .map((o) => o.objectId);
    const owner = normalizeSuiAddress(r.ownerAddress);
    let discId: string | null = null;
    for (const id of created(/::disc::Disc$/)) {
      const disc = await getDisc(core, id);
      if (disc.name === r.discName && normalizeSuiAddress(disc.owner) === owner) discId = id;
    }
    let allowanceId: string | null = null;
    for (const id of created(/::allowance::Allowance</)) {
      if ((await getAllowance(core, id)).name === r.discName) allowanceId = id;
    }
    let capId: string | null = null;
    for (const id of created(/::allowance::AllowanceCap</)) {
      const { object } = await core.getObject({ objectId: id, include: { content: true } });
      const cap = AllowanceCapBcs.parse(object.content);
      if (allowanceId && normalizeSuiAddress(cap.allowance) === normalizeSuiAddress(allowanceId))
        capId = id;
    }
    if (!created(/::disc::Disc$/).length)
      throw new RemoraError("tx.not_issue", "That transaction didn't issue a Disc.");
    if (!discId || !allowanceId || !capId)
      throw new RemoraError("tx.wrong_disc", "That transaction didn't issue this remora's Disc.");
    return { discId, allowanceId, capId };
  }

  const config = (r: Remora) =>
    RemoraConfig.parse({ ...r.config, status: r.status === "creating" ? "shadow" : r.status });

  return {
    templates: () => TEMPLATES,

    async list(owner: string, network: SuiNetwork) {
      return db
        .select()
        .from(remoras)
        .where(
          and(eq(remoras.ownerAddress, normalizeSuiAddress(owner)), eq(remoras.network, network)),
        )
        .orderBy(desc(remoras.createdAt));
    },

    get: mine,
    config,

    /**
     * B1/B3: creates the remora's key and row, and for paying templates returns the owner's one-PTB
     * issue transaction (propose_for_app + disc::issue). Read-only templates are ready at once.
     */
    /**
     * B1/B3: creates the remora's key and row, and for paying templates returns the owner's one-PTB
     * issue transaction (propose_for_app + disc::issue). Read-only templates are ready at once.
     */
    async create(input: CreateInput): Promise<{ remora: Remora; transaction: string | null }> {
      const { remora, issue } = await this.prepare(input);
      if (!issue) return { remora, transaction: null };
      const tx = buildIssue(discCfg(input.network), issue);
      tx.setSender(normalizeSuiAddress(input.owner));
      return { remora, transaction: await tx.toJSON() };
    },

    /** A whole team (ADR-0042): every Disc issue in ONE owner transaction. */
    async createTeam(
      owner: string,
      network: SuiNetwork,
      members: Omit<CreateInput, "owner" | "network">[],
    ): Promise<{ remoras: Remora[]; transaction: string | null }> {
      const made: { remora: Remora; issue: IssueArgs | null }[] = [];
      for (const m of members) made.push(await this.prepare({ ...m, owner, network }));
      const issues = made.flatMap((x) => (x.issue ? [x.issue] : []));
      const team = made.map((x) => x.remora);
      if (!issues.length) return { remoras: team, transaction: null };
      const cfg = discCfg(network);
      const tx = new Transaction();
      for (const a of issues) addIssue(tx, cfg, a);
      tx.setSender(normalizeSuiAddress(owner));
      return { remoras: team, transaction: await tx.toJSON() };
    },

    async prepare(input: CreateInput): Promise<{ remora: Remora; issue: IssueArgs | null }> {
      if (!isTemplateSlug(input.template)) {
        throw new RemoraError("template.unknown", `No template called ${input.template}.`);
      }
      const t = TEMPLATES[input.template];
      const cfg = discCfg(input.network);
      const owner = normalizeSuiAddress(input.owner);
      const id = crypto.randomUUID();
      const keyId = id;
      const address = await deps.signer.create(keyId, input.network);
      const budget =
        input.budget === undefined ? defaultBudget(input.template, cfg.coinType) : input.budget;
      const name = (input.name ?? t.name).slice(0, 40);
      const triggers =
        input.template === "sentinel"
          ? [
              {
                kind: "chain" as const,
                addresses: (input.watch ?? [owner]).map((a) => normalizeSuiAddress(a)),
                objects: [],
                eventTypes: [],
              },
            ]
          : t.triggers;
      const remoraConfig = RemoraConfig.parse({
        version: 1,
        id,
        name,
        template: input.template,
        persona: t.persona,
        tools: t.tools,
        triggers,
        budget,
        status: "shadow",
        identity: { address },
        namespaces:
          input.template === "scout"
            ? ["me", "sources", "feedback", "receipts"]
            : ["me", "rules", "episodes", "receipts"],
      });
      const { status: _s, ...stored } = remoraConfig;
      const discName = `remora-${id.slice(0, 8)}`;
      const needsDisc = !!budget;
      const [remora] = await db
        .insert(remoras)
        .values({
          id,
          ownerAddress: owner,
          network: input.network,
          template: input.template,
          name,
          config: { ...stored, keyId } as Record<string, unknown>,
          status: needsDisc ? "creating" : "shadow",
          address,
          discName: needsDisc ? discName : null,
          shadowUntil: needsDisc
            ? null
            : new Date(now().getTime() + (deps.shadowMs ?? 24 * 3600_000)),
        })
        .returning();
      if (!remora) throw new RemoraError("remora.create_failed", "Couldn't create the remora.");
      deps.log.info("remora.created", {
        remora: id,
        template: input.template,
        network: input.network,
      });
      if (!needsDisc || !budget) {
        await event(remora, "action", `${name} is ready and starts in shadow mode.`);
        return { remora, issue: null };
      }
      return {
        remora,
        issue: issueArgs(discName, address, budget, deps.reef(input.network), now()),
      };
    },

    /** After the owner executed the issue PTB: record the Disc, allowance and cap, enter shadow mode. */
    async confirmIssue(id: string, owner: string, digest: string) {
      const r = await mine(id, owner);
      if (r.status !== "creating")
        throw new RemoraError("remora.already_confirmed", "Already confirmed.", 409);
      const tx = await ownerTx(r, digest);
      const { discId, allowanceId, capId } = await issuedFor(r, tx);
      const updated = await setRow(id, {
        discId,
        allowanceId,
        capId,
        status: "shadow",
        shadowUntil: new Date(now().getTime() + (deps.shadowMs ?? 24 * 3600_000)),
      });
      await event(
        updated,
        "action",
        `${r.name} is ready. Its Disc is live; it starts in shadow mode.`,
        { digest, discId },
      );
      return updated;
    },

    /** The owner skips the rest of shadow mode (N3). */
    async activate(id: string, owner: string) {
      const r = await mine(id, owner);
      if (r.status !== "shadow")
        throw new RemoraError(
          "remora.not_shadow",
          "Only a shadowing remora can be activated.",
          409,
        );
      const updated = await setRow(id, { status: "active", shadowUntil: null });
      await event(updated, "action", `${r.name} is live.`);
      return updated;
    },

    /** B8: an unsigned pause/resume for the wallet; `syncStatus` reads the result back. */
    async pauseTx(id: string, owner: string, paused: boolean) {
      const r = await mine(id, owner);
      if (!r.discId) throw new RemoraError("remora.no_disc", "This remora has no Disc.");
      const tx = buildPause(discCfg(r.network), [r.discId], paused);
      tx.setSender(r.ownerAddress);
      return tx.toJSON();
    },

    async syncStatus(id: string, owner: string) {
      const r = await mine(id, owner);
      if (!r.discId || r.status === "retired" || r.status === "creating") return r;
      const disc = await getDisc(deps.networks.client(r.network).core, r.discId);
      const status = disc.paused ? "paused" : r.status === "paused" ? "active" : r.status;
      if (status === r.status) return r;
      const updated = await setRow(id, { status });
      await event(
        updated,
        "action",
        disc.paused ? `${r.name} is paused.` : `${r.name} is back on.`,
      );
      return updated;
    },

    /** Pause without a Disc (read-only remoras): runtime-only. */
    async setPaused(id: string, owner: string, paused: boolean) {
      const r = await mine(id, owner);
      if (r.discId) throw new RemoraError("remora.has_disc", "Pause its Disc instead.", 409);
      return setRow(id, { status: paused ? "paused" : "active" });
    },

    async retireTx(id: string, owner: string): Promise<string | null> {
      const r = await mine(id, owner);
      if (!r.discId || !r.allowanceId || !r.capId) return null;
      const tx = buildRevoke(discCfg(r.network), {
        discId: r.discId,
        capId: r.capId,
        allowanceId: r.allowanceId,
      });
      tx.setSender(r.ownerAddress);
      return tx.toJSON();
    },

    async confirmRetire(id: string, owner: string, digest?: string) {
      const r = await mine(id, owner);
      if (r.discId) {
        if (!digest) throw new RemoraError("tx.missing", "Send the revoke transaction's digest.");
        await ownerTx(r, digest);
      }
      const updated = await setRow(id, {
        status: "retired",
        discId: null,
        allowanceId: null,
        capId: null,
      });
      await event(
        updated,
        "action",
        `${r.name} is retired. Its memory stays yours.`,
        digest ? { digest } : {},
      );
      return updated;
    },

    /** B7: budget change = revoke + reissue in one owner PTB, same Disc name. */
    async budgetTx(id: string, owner: string, budget: Budget) {
      const r = await mine(id, owner);
      if (!r.discId || !r.allowanceId || !r.capId || !r.discName) {
        throw new RemoraError("remora.no_disc", "This remora has no Disc.");
      }
      const args = issueArgs(r.discName, r.address, budget, deps.reef(r.network), now());
      const tx: Transaction = buildRevokeAndReissue(
        discCfg(r.network),
        { discId: r.discId, capId: r.capId, allowanceId: r.allowanceId },
        args,
      );
      tx.setSender(r.ownerAddress);
      return tx.toJSON();
    },

    async confirmBudget(id: string, owner: string, digest: string, budget: Budget) {
      const r = await mine(id, owner);
      const tx = await ownerTx(r, digest);
      const discId = createdOf(tx, /::disc::Disc$/);
      const allowanceId = createdOf(tx, /::allowance::Allowance</);
      const capId = createdOf(tx, /::allowance::AllowanceCap</);
      if (!discId || !allowanceId || !capId)
        throw new RemoraError("tx.not_issue", "That transaction didn't reissue the Disc.");
      const updated = await setRow(id, {
        discId,
        allowanceId,
        capId,
        config: { ...r.config, budget } as Record<string, unknown>,
      });
      await event(updated, "action", `${r.name}'s budget changed.`, { digest, budget });
      return updated;
    },

    /** B9: a fresh key for the remora; the owner signs `disc::rotate`, then `confirmRotate` switches. */
    async rotateTx(id: string, owner: string) {
      const r = await mine(id, owner);
      if (!r.discId || !r.allowanceId)
        throw new RemoraError("remora.no_disc", "This remora has no Disc.");
      const generation = Number((r.config as { keyGeneration?: number }).keyGeneration ?? 1) + 1;
      const keyId = `${r.id}:${generation}`;
      const newSpender = await deps.signer.create(keyId, r.network);
      const tx = buildRotate(discCfg(r.network), {
        discId: r.discId,
        allowanceId: r.allowanceId,
        newSpender,
      });
      tx.setSender(r.ownerAddress);
      return { transaction: await tx.toJSON(), keyId, newSpender };
    },

    async confirmRotate(id: string, owner: string, digest: string, keyId: string) {
      const r = await mine(id, owner);
      await ownerTx(r, digest);
      const allowance = await getAllowance(
        deps.networks.client(r.network).core,
        r.allowanceId ?? "",
      );
      const newAddress = await deps.signer.address(keyId);
      if (normalizeSuiAddress(allowance.spender ?? "") !== normalizeSuiAddress(newAddress)) {
        throw new RemoraError("tx.not_rotate", "The Disc's spender isn't the new key.");
      }
      const generation = Number(keyId.split(":")[1] ?? 1);
      const updated = await setRow(id, {
        address: newAddress,
        config: { ...r.config, keyId, keyGeneration: generation } as Record<string, unknown>,
      });
      await event(updated, "action", `${r.name} has a new key. The old one can't spend anymore.`, {
        digest,
      });
      return updated;
    },

    /** B6: edit name, persona or watched addresses. The previous config goes into the feed. */
    async edit(
      id: string,
      owner: string,
      patch: { name?: string; persona?: string; watch?: string[]; model?: string | null },
    ) {
      const r = await mine(id, owner);
      const prev = r.config as Record<string, unknown> & { revision?: number };
      const next: Record<string, unknown> = { ...prev, revision: (prev.revision ?? 1) + 1 };
      if (patch.name !== undefined) next.name = patch.name.trim().slice(0, 40);
      if (patch.persona !== undefined) next.persona = patch.persona.trim().slice(0, 2_000);
      if (patch.model !== undefined) {
        // D9 (ADR-0042): a catalog id, or null for the server default.
        if (patch.model !== null && !isCatalogModel(patch.model))
          throw new RemoraError("model.unknown", "That model isn't in the catalog.");
        if (patch.model === null) delete next.model;
        else next.model = patch.model;
      }
      if (patch.watch !== undefined) {
        if (r.template !== "sentinel")
          throw new RemoraError("remora.no_watch", "Only Sentinels watch addresses.");
        next.triggers = [
          {
            kind: "chain",
            addresses: patch.watch.map((a) => normalizeSuiAddress(a)),
            objects: [],
            eventTypes: [],
          },
        ];
      }
      RemoraConfig.parse({ ...next, status: "shadow" });
      const updated = await setRow(id, {
        config: next,
        ...(typeof next.name === "string" ? { name: next.name } : {}),
      });
      await event(
        updated,
        "config_changed",
        `${updated.name}'s settings changed (revision ${String(next.revision)}).`,
        {
          previous: prev,
          revision: next.revision,
        },
      );
      return updated;
    },

    /** N10: one owner transaction pauses every Disc on this network; Disc-less remoras pause on confirm. */
    async panicTx(owner: string, network: SuiNetwork) {
      const rows = await db
        .select()
        .from(remoras)
        .where(
          and(eq(remoras.ownerAddress, normalizeSuiAddress(owner)), eq(remoras.network, network)),
        );
      const discs = rows
        .filter((r) => r.discId && r.status !== "retired")
        .map((r) => r.discId as string);
      if (!discs.length) return { transaction: null, discs: 0 };
      const tx = buildPause(discCfg(network), discs, true);
      tx.setSender(normalizeSuiAddress(owner));
      return { transaction: await tx.toJSON(), discs: discs.length };
    },

    async confirmPanic(owner: string, network: SuiNetwork, digest?: string) {
      const rows = await db
        .select()
        .from(remoras)
        .where(
          and(eq(remoras.ownerAddress, normalizeSuiAddress(owner)), eq(remoras.network, network)),
        );
      const withDisc = rows.find((r) => r.discId && r.status !== "retired");
      if (withDisc) {
        if (!digest) throw new RemoraError("tx.missing", "Send the pause transaction's digest.");
        await ownerTx(withDisc, digest);
      }
      const paused: string[] = [];
      for (const r of rows) {
        if (r.status === "retired" || r.status === "paused") continue;
        if (r.discId) {
          const disc = await getDisc(deps.networks.client(r.network).core, r.discId);
          if (!disc.paused) continue;
        }
        const updated = await setRow(r.id, { status: "paused" });
        await event(
          updated,
          "action",
          `${r.name} is paused (panic button).`,
          digest ? { digest } : {},
        );
        paused.push(r.id);
      }
      return { paused };
    },

    /** N5: budget meter straight from the allowance. */
    async budgetMeter(id: string, owner: string) {
      const r = await mine(id, owner);
      if (!r.allowanceId || !r.discId) return null;
      const core = deps.networks.client(r.network).core;
      // Right after a retire or a budget change the old objects are gone before the row catches up.
      const read = await Promise.all([
        getAllowance(core, r.allowanceId),
        getDisc(core, r.discId),
      ]).catch((err) => {
        if (/not found|deleted/i.test(String((err as Error).message))) return null;
        throw err;
      });
      if (!read) return null;
      const [allowance, disc] = read;
      return {
        spent: allowance.currentSpend.toString(),
        lifetimeCap: allowance.lifetimeCap?.toString() ?? null,
        window: allowance.rateLimit
          ? {
              limit: allowance.rateLimit.limit.toString(),
              spent: allowance.rateLimit.spent.toString(),
            }
          : null,
        perPaymentCap: disc.perPaymentCap.toString(),
        paused: disc.paused,
        expiresAt: allowance.expiryMs ? new Date(allowance.expiryMs).toISOString() : null,
        payees: disc.payees,
        forecast: await forecast(r, allowance.rateLimit),
      };
    },

    /** The remora's signing key id (rotations add a generation). */
    keyIdOf: (r: Remora) => String((r.config as { keyId?: string }).keyId ?? r.id),
    reefPayee: reefRef,
  };
}

export type RemoraService = ReturnType<typeof createRemoraService>;
