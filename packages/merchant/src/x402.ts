/**
 * `@remora/merchant`: turns a Hono route into an x402 service (E9). No payment header → `402` with
 * PaymentRequirements for every network the merchant serves. With one → verify and **settle first**
 * through the facilitator, then run the handler, so unpaid work never leaks.
 *
 * ADR-0111: `settle: "after"` is for work that can fail after it starts (a remora's sold answer):
 * verify, run the handler, and settle only when it answered 2xx. A failed answer costs the buyer
 * nothing, and an answer whose settlement fails is replaced by the 402, so it never leaks unpaid.
 *
 * ADR-0120: the same door speaks MPP (`mpp.ts`). Its 402 also carries `WWW-Authenticate: Payment`
 * challenges, and `Authorization: Payment` pays it: a signed transaction through the same facilitator
 * path (both settle modes), or a digest the payer already executed (@suimpp/mpp), read over gRPC.
 */
import type { ClientWithCoreApi } from "@mysten/sui/client";
import {
  decodeHeader,
  encodeHeader,
  fromX402Network,
  PAYMENT_HEADER,
  PAYMENT_RESPONSE_HEADER,
  type PaymentPayload,
  type PaymentRequired,
  type PaymentRequirements,
  type SettleResponse,
  type SuiNetworkName,
  toX402Network,
  type VerifyResponse,
  X402_VERSION,
} from "@remora/disc-sdk";
import type { Context, MiddlewareHandler, Next } from "hono";
import { type BazaarExtension, bazaarExtension, type DoorDiscovery } from "./discovery.ts";
import { checkDigest, type MppOptions, mppDoor } from "./mpp.ts";

export interface DoorNetwork {
  payTo: string;
  asset: string;
  facilitatorUrl: string;
  /** The asset's decimals, for MPP's whole-unit amount. Defaults to USDC's 6. */
  decimals?: number;
  /** Reads MPP digest credentials (@suimpp/mpp's clients) over gRPC; without it they're refused. */
  client?: ClientWithCoreApi;
}

export interface X402Options {
  /** Smallest units of the network's asset. */
  amount: string;
  description?: string;
  /** Only these networks are offered. */
  networks: Partial<Record<SuiNetworkName, DoorNetwork>>;
  /** Require a Disc payment (`remora::disc::pay` + `Paid`). */
  disc?: boolean;
  maxTimeoutSeconds?: number;
  /** `first` (the default): settle, then run the handler. `after`: run it, then settle on a 2xx. */
  settle?: "first" | "after";
  /** MPP beside x402 (ADR-0120), on unless `false`. */
  mpp?: MppOptions | false;
  /** ADR-0141: the 402 carries x402's Bazaar extension (`extensions.bazaar`) describing the door. */
  discovery?: DoorDiscovery;
  fetch?: typeof fetch;
}

/** A door's 402 body: x402's, plus the extensions it declares (ADR-0141). */
export interface DoorPaymentRequired extends PaymentRequired {
  extensions?: { bazaar?: BazaarExtension };
}

export interface PaidContext {
  network: SuiNetworkName;
  payer: string;
  /** The settled digest. With `settle: "after"` it's empty while the handler runs, then set. */
  transaction: string;
  intent?: string;
}

export function requirementsFor(o: X402Options, resource: string): PaymentRequirements[] {
  return Object.entries(o.networks).map(([network, n]) => ({
    scheme: "exact" as const,
    network: toX402Network(network as SuiNetworkName),
    amount: o.amount,
    asset: n.asset,
    payTo: n.payTo,
    maxTimeoutSeconds: o.maxTimeoutSeconds ?? 60,
    resource,
    ...(o.description ? { description: o.description } : {}),
    extra: {
      gasStation: `${n.facilitatorUrl.replace(/\/$/, "")}/gas`,
      ...(o.disc ? { disc: true } : {}),
    },
  }));
}

const answered = (c: Context) => c.res.status >= 200 && c.res.status < 300;

export function x402(o: X402Options): MiddlewareHandler<{ Variables: { x402: PaidContext } }> {
  const http = o.fetch ?? fetch;
  const mpp = o.mpp === false ? null : mppDoor(o, o.mpp ?? {});
  const extensions = o.discovery ? { bazaar: bazaarExtension(o.discovery) } : undefined;
  const required = (c: Context, error: string) => {
    const body: DoorPaymentRequired = {
      x402Version: X402_VERSION,
      accepts: requirementsFor(o, c.req.url),
      error,
      ...(extensions ? { extensions } : {}),
    };
    return c.json(body, 402, mpp ? mpp.headers(c) : {});
  };

  /** Verify and settle through the facilitator, in the door's settle mode, for either protocol. */
  const pay = async (
    c: Context,
    next: Next,
    p: {
      network: SuiNetworkName;
      n: DoorNetwork;
      req: PaymentRequirements;
      payload: PaymentPayload;
      protocol: "x402" | "mpp";
    },
  ) => {
    const refuse = (reason: string) =>
      mpp && p.protocol === "mpp"
        ? mpp.refuse(c, "verification-failed", reason)
        : required(c, reason);
    const call = async <T>(path: string) => {
      const res = await http(`${p.n.facilitatorUrl.replace(/\/$/, "")}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentPayload: p.payload, paymentRequirements: p.req }),
      });
      return (await res.json()) as T;
    };

    const verified = await call<VerifyResponse>("/verify");
    if (!verified.isValid) return refuse(verified.invalidReason ?? "invalid payment");
    if (o.settle === "after") {
      const paid: PaidContext = {
        network: p.network,
        payer: verified.payer ?? "",
        transaction: "",
        ...(verified.intent ? { intent: verified.intent } : {}),
      };
      c.set("x402", paid);
      await next();
      if (!answered(c)) return;
      const done = await call<SettleResponse & { error?: { message?: string } }>("/settle");
      if (!done.success || !done.transaction) {
        c.res = undefined;
        c.res = refuse(done.errorReason ?? done.error?.message ?? "settlement failed");
        return;
      }
      c.set("x402", { ...paid, payer: done.payer ?? paid.payer, transaction: done.transaction });
      if (mpp && p.protocol === "mpp") mpp.receipt(c, done.transaction);
      else c.header(PAYMENT_RESPONSE_HEADER, encodeHeader(done));
      return;
    }
    const settled = await call<SettleResponse & { error?: { message?: string } }>("/settle");
    if (!settled.success || !settled.transaction)
      return refuse(settled.errorReason ?? settled.error?.message ?? "settlement failed");

    if (p.protocol === "x402") c.header(PAYMENT_RESPONSE_HEADER, encodeHeader(settled));
    c.set("x402", {
      network: p.network,
      payer: settled.payer ?? verified.payer ?? "",
      transaction: settled.transaction,
      ...(verified.intent ? { intent: verified.intent } : {}),
    });
    await next();
    if (mpp && p.protocol === "mpp" && answered(c)) mpp.receipt(c, settled.transaction);
  };

  return async (c, next) => {
    const header = c.req.header(PAYMENT_HEADER);
    const credential = mpp ? mpp.read(c) : ({ kind: "none" } as const);
    if (mpp && credential.kind !== "none") {
      if (header || credential.kind === "many")
        return mpp.refuse(c, "bad-request", "Send one payment credential.", 400);
      if (credential.kind === "malformed")
        return mpp.refuse(c, "malformed-credential", credential.detail);
      const accepted = mpp.accept(c, credential.credential);
      if (!accepted.ok) return mpp.refuse(c, accepted.problem, accepted.detail);
      const { network, n } = accepted;
      const payload = credential.credential.payload;
      if ("digest" in payload) {
        if (o.disc)
          return mpp.refuse(
            c,
            "verification-failed",
            "This door takes Disc payments only: send a signed remora::disc::pay transaction.",
          );
        if (!n.client)
          return mpp.refuse(
            c,
            "verification-failed",
            "This door can't read a transaction by digest: send a signed transaction instead.",
          );
        const checked = await checkDigest(n.client, {
          challenge: credential.credential.challenge,
          request: accepted.request,
          issuedAt: accepted.issuedAt,
          digest: payload.digest,
          signature: payload.signature,
        });
        if (!checked.ok) return mpp.refuse(c, "verification-failed", checked.detail);
        // Already executed: there is nothing left to settle, in either mode.
        c.set("x402", { network, payer: checked.payer, transaction: payload.digest });
        await next();
        if (answered(c)) mpp.receipt(c, payload.digest);
        return;
      }
      const req = requirementsFor(o, c.req.url).find((r) => r.network === toX402Network(network));
      if (!req)
        return mpp.refuse(c, "invalid-challenge", "This door no longer sells on that network.");
      return pay(c, next, {
        network,
        n,
        req,
        payload: {
          x402Version: X402_VERSION,
          scheme: "exact",
          network: req.network,
          payload: { signature: payload.signature, transaction: payload.transaction },
        },
        protocol: "mpp",
      });
    }

    if (!header) return required(c, "payment required");
    let payload: PaymentPayload;
    try {
      payload = decodeHeader<PaymentPayload>(header);
    } catch {
      return required(c, "malformed payment header");
    }
    const network = fromX402Network(payload.network);
    const n = network ? o.networks[network] : undefined;
    const req = network && requirementsFor(o, c.req.url).find((r) => r.network === payload.network);
    if (!network || !n || !req) return required(c, "network not accepted");
    return pay(c, next, { network, n, req, payload, protocol: "x402" });
  };
}
