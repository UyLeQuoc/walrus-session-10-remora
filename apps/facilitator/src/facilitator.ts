/**
 * E3: the x402 `exact` facilitator for Sui, plus the gas station (D8). Verify simulates through
 * Tatum and checks the `payTo` balance change; settle co-signs as sponsor (if sponsored) and executes
 * through Tatum. Disc-aware requirements also need a `remora::disc::pay` with a matching `Paid` event;
 * any payment that has one reports its intent.
 */
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction, TransactionDataBuilder } from "@mysten/sui/transactions";
import { fromBase64, normalizeStructTag, normalizeSuiAddress, toBase64 } from "@mysten/sui/utils";
import { verifyTransactionSignature } from "@mysten/sui/verify";
import type { Logger } from "@remora/chain";
import {
  fromX402Network,
  type PaymentPayload,
  type PaymentRequirements,
  paidEvents,
  type SettleResponse,
  type SuiNetworkName,
  toDiscError,
  toX402Network,
  type VerifyResponse,
} from "@remora/disc-sdk";
import { type Sponsor, SponsorRefusal } from "@remora/signer";
import { GasCoinPool, GasPoolBusy } from "./gas-pool.ts";
import { type SponsorLedger, utcDay } from "./ledger.ts";

export interface NetworkDeps {
  network: SuiNetworkName;
  client: SuiGrpcClient;
  sponsor: Sponsor | null;
  /** Remora's `disc` package on this network, for Disc-aware verification. */
  packageId: string | null;
  usdcCoinType: string;
}

export interface FacilitatorDeps {
  networks: Partial<Record<SuiNetworkName, NetworkDeps>>;
  ledger: SponsorLedger;
  /** Per sender (remora key) per UTC day, in MIST. */
  dailyGasBudget: bigint;
  log: Logger;
  now?: () => Date;
}

export class GasStationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const invalid = (invalidReason: string, payer?: string): VerifyResponse => ({
  isValid: false,
  invalidReason,
  ...(payer ? { payer } : {}),
});

const sameType = (a: string, b: string) => {
  try {
    return normalizeStructTag(a) === normalizeStructTag(b);
  } catch {
    return a === b;
  }
};

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

export function createFacilitator(deps: FacilitatorDeps) {
  const now = deps.now ?? (() => new Date());

  const net = (n: SuiNetworkName | null) => (n ? deps.networks[n] : undefined);

  /** One gas coin pool per sponsored network (D8). */
  const pools = new Map<SuiNetworkName, GasCoinPool>();
  const poolOf = (n: NetworkDeps & { sponsor: Sponsor }) => {
    let p = pools.get(n.network);
    if (!p) {
      p = new GasCoinPool({
        list: async () =>
          (await n.client.core.listCoins({ owner: n.sponsor.address, coinType: "0x2::sui::SUI" }))
            .objects,
        // A real budget is a few MIST million; this floor keeps nearly-spent coins out of the pool.
        minBalance:
          n.sponsor.policy.maxGasBudget < 20_000_000n ? n.sponsor.policy.maxGasBudget : 20_000_000n,
      });
      pools.set(n.network, p);
    }
    return p;
  };
  const sponsorCoins = (bytes: Uint8Array) =>
    (Transaction.from(bytes).getData().gasData.payment ?? []).map((c) => c.objectId);

  /** Reserves gas for a sponsored transaction against the sender's daily budget. */
  async function reserveGas(n: NetworkDeps, bytes: Uint8Array, sender: string, budget: bigint) {
    const day = utcDay(now());
    const digest = TransactionDataBuilder.getDigestFromBytes(bytes);
    const already = await deps.ledger.reservedFor(n.network, digest);
    if (already !== null) return digest;
    const spent = await deps.ledger.spentToday(n.network, sender, day);
    if (spent + budget > deps.dailyGasBudget) {
      throw new GasStationError(
        "sponsor.out_of_gas",
        `Daily gas budget used up for ${sender} (${spent} + ${budget} > ${deps.dailyGasBudget}).`,
      );
    }
    await deps.ledger.reserve({ network: n.network, sender, day, digest, gasBudget: budget });
    return digest;
  }

  return {
    supported() {
      return {
        kinds: Object.values(deps.networks)
          .filter((n): n is NetworkDeps => !!n)
          .map((n) => ({
            x402Version: 1,
            scheme: "exact",
            network: toX402Network(n.network),
            extra: { sponsored: !!n.sponsor, discAware: !!n.packageId },
          })),
      };
    },

    /** Gas station: a gasless transaction kind in, a complete sponsored transaction out. */
    async gas(input: { network: string; sender: string; transactionKind: string }) {
      const n = net(fromX402Network(input.network) ?? (input.network as SuiNetworkName));
      if (!n?.sponsor)
        throw new GasStationError("network.unavailable", `No sponsor on ${input.network}.`);
      const sender = normalizeSuiAddress(input.sender);
      const tx = Transaction.fromKind(fromBase64(input.transactionKind));
      tx.setSender(sender);
      tx.setGasOwner(n.sponsor.address);
      const pool = poolOf(n as NetworkDeps & { sponsor: Sponsor });
      const coin = await pool.take().catch((err) => {
        if (err instanceof GasPoolBusy) throw new GasStationError(err.code, err.message);
        throw err;
      });
      tx.setGasPayment([coin]);
      let bytes: Uint8Array;
      try {
        // Building simulates for the gas budget, so a doomed payment (over cap, bad payee…) fails here.
        bytes = await tx.build({ client: n.client });
      } catch (err) {
        pool.release([coin.objectId]);
        throw new GasStationError(
          `simulation_failed:${toDiscError(err).code}`,
          (err as Error).message,
        );
      }
      let inspected: { gasBudget: bigint | null };
      try {
        inspected = n.sponsor.inspectBytes(bytes);
      } catch (err) {
        if (err instanceof SponsorRefusal) throw new GasStationError(err.code, err.message);
        throw err;
      }
      const digest = await reserveGas(n, bytes, sender, inspected.gasBudget ?? 0n);
      deps.log.info("gas.sponsored", {
        network: n.network,
        sender,
        digest,
        budget: inspected.gasBudget,
      });
      return { transaction: toBase64(bytes), digest };
    },

    async verify(payload: PaymentPayload, req: PaymentRequirements): Promise<VerifyResponse> {
      if (payload.scheme !== "exact" || req.scheme !== "exact")
        return invalid("unsupported_scheme");
      if (payload.network !== req.network) return invalid("network_mismatch");
      const n = net(fromX402Network(payload.network));
      if (!n) return invalid("network_unavailable");

      let bytes: Uint8Array;
      let data: ReturnType<Transaction["getData"]>;
      try {
        bytes = fromBase64(payload.payload.transaction);
        data = Transaction.from(bytes).getData();
      } catch {
        return invalid("invalid_transaction");
      }
      const payer = data.sender ? normalizeSuiAddress(data.sender) : "";
      if (!payer) return invalid("invalid_transaction");
      try {
        await verifyTransactionSignature(bytes, payload.payload.signature, { address: payer });
      } catch {
        return invalid("invalid_signature", payer);
      }

      const gasOwner = normalizeSuiAddress(data.gasData.owner ?? payer);
      if (gasOwner !== payer) {
        if (!n.sponsor || gasOwner !== normalizeSuiAddress(n.sponsor.address)) {
          return invalid("unknown_gas_owner", payer);
        }
        try {
          n.sponsor.inspectBytes(bytes);
        } catch (err) {
          return invalid(err instanceof SponsorRefusal ? err.code : "sponsor_refused", payer);
        }
      }

      const sim = await n.client.core.simulateTransaction({
        transaction: bytes,
        include: { balanceChanges: true, events: true, effects: true },
      });
      const t = sim.Transaction ?? sim.FailedTransaction;
      if (!t.effects?.status.success) {
        return invalid(`simulation_failed:${toDiscError(t.effects?.status.error).code}`, payer);
      }
      const payTo = normalizeSuiAddress(req.payTo);
      const credited = (t.balanceChanges ?? [])
        .filter((b) => normalizeSuiAddress(b.address) === payTo && sameType(b.coinType, req.asset))
        .reduce((sum, b) => sum + BigInt(b.amount), 0n);
      if (credited !== BigInt(req.amount)) return invalid("amount_mismatch", payer);

      const digest = TransactionDataBuilder.getDigestFromBytes(bytes);
      const seen = await n.client.core.getTransaction({ digest }).then(
        () => true,
        () => false,
      );
      if (seen) return invalid("already_executed", payer);

      // A Disc payment carries its Wake intent in `Paid`; report it whenever there is one (ADR-0031).
      let intent: string | undefined;
      if (n.packageId) {
        const cfg = { packageId: n.packageId, registryId: "", coinType: req.asset };
        const paid = paidEvents(cfg, t.events).find(
          (p) => normalizeSuiAddress(p.payee) === payTo && p.amount === BigInt(req.amount),
        );
        if (paid) intent = hex(paid.intent);
      }
      if (req.extra?.disc && !intent) {
        return invalid(n.packageId ? "not_a_disc_payment" : "disc_unavailable", payer);
      }
      return { isValid: true, payer, ...(intent ? { intent } : {}) };
    },

    async settle(payload: PaymentPayload, req: PaymentRequirements): Promise<SettleResponse> {
      try {
        return await settleOnce(payload, req, this.verify.bind(this));
      } finally {
        // Executed or refused, the transaction no longer needs its sponsor gas coin held.
        const n = net(fromX402Network(payload.network));
        const pool = n && pools.get(n.network);
        if (pool) {
          try {
            pool.release(sponsorCoins(fromBase64(payload.payload.transaction)));
          } catch {
            // Malformed bytes never took a coin.
          }
        }
      }
    },
  };

  async function settleOnce(
    payload: PaymentPayload,
    req: PaymentRequirements,
    verify: (p: PaymentPayload, r: PaymentRequirements) => Promise<VerifyResponse>,
  ): Promise<SettleResponse> {
    const network = payload.network;
    const v = await verify(payload, req);
    if (!v.isValid) {
      return {
        success: false,
        network,
        errorReason: v.invalidReason ?? "invalid",
        ...(v.payer ? { payer: v.payer } : {}),
      };
    }
    const n = net(fromX402Network(network)) as NetworkDeps;
    const bytes = fromBase64(payload.payload.transaction);
    const data = Transaction.from(bytes).getData();
    const payer = v.payer as string;
    const signatures = [payload.payload.signature];
    const sponsored = normalizeSuiAddress(data.gasData.owner ?? payer) !== payer;
    let digest = TransactionDataBuilder.getDigestFromBytes(bytes);
    if (sponsored && n.sponsor) {
      try {
        const { signature, inspected } = await n.sponsor.cosign(bytes);
        // Built without the gas station? Then the budget check happens here.
        digest = await reserveGas(n, bytes, payer, inspected.gasBudget ?? 0n);
        signatures.push(signature);
      } catch (err) {
        const code =
          err instanceof GasStationError || err instanceof SponsorRefusal
            ? err.code
            : "sponsor_refused";
        return { success: false, network, payer, errorReason: code };
      }
    }
    const res = await n.client.core.executeTransaction({
      transaction: bytes,
      signatures,
      include: { effects: true },
    });
    const done = res.Transaction ?? res.FailedTransaction;
    const gas = done.effects?.gasUsed;
    const gasUsed = gas
      ? BigInt(gas.computationCost) + BigInt(gas.storageCost) - BigInt(gas.storageRebate)
      : 0n;
    if (sponsored) await deps.ledger.settle(n.network, digest, gasUsed > 0n ? gasUsed : 0n);
    if (!done.effects?.status.success) {
      deps.log.warn("settle.failed", { network: n.network, digest: done.digest, payer });
      return {
        success: false,
        network,
        payer,
        transaction: done.digest,
        errorReason: toDiscError(done.effects?.status.error).code,
      };
    }
    await n.client.core.waitForTransaction({ digest: done.digest });
    deps.log.info("settle.ok", {
      network: n.network,
      digest: done.digest,
      payer,
      gasUsed,
      sponsored,
    });
    return { success: true, network, payer, transaction: done.digest };
  }
}

export type Facilitator = ReturnType<typeof createFacilitator>;
