/**
 * `@remora/merchant`: turns a Hono route into an x402 service (E9). No payment header → `402` with
 * PaymentRequirements for every network the merchant serves. With one → verify and **settle first**
 * through the facilitator, then run the handler, so unpaid work never leaks.
 */
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
import type { Context, MiddlewareHandler } from "hono";

export interface X402Options {
  /** Smallest units of the network's asset. */
  amount: string;
  description?: string;
  /** Only these networks are offered. */
  networks: Partial<
    Record<SuiNetworkName, { payTo: string; asset: string; facilitatorUrl: string }>
  >;
  /** Require a Disc payment (`remora::disc::pay` + `Paid`). */
  disc?: boolean;
  maxTimeoutSeconds?: number;
  fetch?: typeof fetch;
}

export interface PaidContext {
  network: SuiNetworkName;
  payer: string;
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

export function x402(o: X402Options): MiddlewareHandler<{ Variables: { x402: PaidContext } }> {
  const http = o.fetch ?? fetch;
  const required = (c: Context, error: string) => {
    const body: PaymentRequired = {
      x402Version: X402_VERSION,
      accepts: requirementsFor(o, c.req.url),
      error,
    };
    return c.json(body, 402);
  };

  return async (c, next) => {
    const header = c.req.header(PAYMENT_HEADER);
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

    const call = async <T>(path: string) => {
      const res = await http(`${n.facilitatorUrl.replace(/\/$/, "")}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentPayload: payload, paymentRequirements: req }),
      });
      return (await res.json()) as T;
    };

    const verified = await call<VerifyResponse>("/verify");
    if (!verified.isValid) return required(c, verified.invalidReason ?? "invalid payment");
    const settled = await call<SettleResponse & { error?: { message?: string } }>("/settle");
    if (!settled.success || !settled.transaction)
      return required(c, settled.errorReason ?? settled.error?.message ?? "settlement failed");

    c.header(PAYMENT_RESPONSE_HEADER, encodeHeader(settled));
    c.set("x402", {
      network,
      payer: settled.payer ?? verified.payer ?? "",
      transaction: settled.transaction,
      ...(verified.intent ? { intent: verified.intent } : {}),
    });
    await next();
  };
}
