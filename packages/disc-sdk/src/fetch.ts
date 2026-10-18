/**
 * `disc.fetch` (E2): an x402 client that pays through the remora's Disc. On a `402` it picks the
 * requirement for its network and coin, checks the soft budget, builds `disc::pay` with the Wake's
 * intent hash (G2), gets gas sponsored by the gas station, signs as the remora, and retries with the
 * payment header. The Disc enforces the hard limits onchain.
 */
import type { ClientWithCoreApi } from "@mysten/sui/client";
import type { Transaction } from "@mysten/sui/transactions";
import { fromBase64, normalizeStructTag, toBase64 } from "@mysten/sui/utils";
import { buildPay } from "./builders.ts";
import type { DiscConfig } from "./config.ts";
import {
  decodeHeader,
  encodeHeader,
  PAYMENT_HEADER,
  PAYMENT_RESPONSE_HEADER,
  type PaymentPayload,
  type PaymentRequired,
  type PaymentRequirements,
  type SettleResponse,
  type SuiNetworkName,
  toX402Network,
  X402_VERSION,
} from "./x402.ts";

export interface DiscFetchOptions {
  network: SuiNetworkName;
  cfg: DiscConfig;
  disc: { discId: string; allowanceId: string; funder: string };
  /** The remora's address (the Disc's spender). */
  sender: string;
  sign(bytes: Uint8Array): Promise<string>;
  /** Soft budget for one call, at or below the Disc's per-payment cap (Sonar can lower it). */
  maxAmount: bigint;
  /** sha256 of the Wake intent for this payment, built from the chosen requirements. */
  intentFor(req: PaymentRequirements): Promise<Uint8Array> | Uint8Array;
  /** Resolves object refs for the transaction kind (any `client.core`-capable client). */
  client?: ClientWithCoreApi;
  /** Overrides kind building (tests). */
  buildKind?: (tx: Transaction) => Promise<Uint8Array>;
  fetch?: typeof fetch;
}

export class DiscFetchError extends Error {
  constructor(
    readonly code:
      | "x402.no_matching_requirements"
      | "x402.over_soft_budget"
      | "x402.no_gas_station"
      | "x402.gas_station_refused",
    message: string,
  ) {
    super(message);
  }
}

export interface DiscPayment {
  requirements: PaymentRequirements;
  intent: Uint8Array;
  settle: SettleResponse | null;
}

const sameType = (a: string, b: string) => {
  try {
    return normalizeStructTag(a) === normalizeStructTag(b);
  } catch {
    return a === b;
  }
};

export async function discFetch(
  o: DiscFetchOptions,
  url: string,
  init: RequestInit = {},
): Promise<{ response: Response; payment: DiscPayment | null }> {
  const http = o.fetch ?? fetch;
  const first = await http(url, init);
  if (first.status !== 402) return { response: first, payment: null };

  const required = (await first.json()) as PaymentRequired;
  const network = toX402Network(o.network);
  const req = required.accepts.find(
    (r) => r.scheme === "exact" && r.network === network && sameType(r.asset, o.cfg.coinType),
  );
  if (!req) {
    throw new DiscFetchError(
      "x402.no_matching_requirements",
      `No ${network} requirement in ${o.cfg.coinType} (offered: ${required.accepts.map((r) => r.network).join(", ")}).`,
    );
  }
  const amount = BigInt(req.amount);
  if (amount > o.maxAmount) {
    throw new DiscFetchError(
      "x402.over_soft_budget",
      `${amount} is over the soft budget ${o.maxAmount}.`,
    );
  }
  if (!req.extra?.gasStation) {
    throw new DiscFetchError(
      "x402.no_gas_station",
      "Remoras hold no SUI, so the merchant must offer a gas station.",
    );
  }

  const intent = await o.intentFor(req);
  const tx = buildPay(o.cfg, { ...o.disc, payee: req.payTo, amount, intent }, { sender: o.sender });
  const kind = o.buildKind
    ? await o.buildKind(tx)
    : await tx.build({ ...(o.client ? { client: o.client } : {}), onlyTransactionKind: true });

  const gas = await http(req.extra.gasStation, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      network: req.network,
      sender: o.sender,
      transactionKind: toBase64(kind),
    }),
  });
  const sponsored = (await gas.json()) as {
    transaction?: string;
    error?: { code: string; message: string };
  };
  if (!gas.ok || !sponsored.transaction) {
    throw new DiscFetchError(
      "x402.gas_station_refused",
      `${sponsored.error?.code ?? gas.status}: ${sponsored.error?.message ?? "no transaction"}`,
    );
  }
  const bytes = fromBase64(sponsored.transaction);
  const signature = await o.sign(bytes);
  const payload: PaymentPayload = {
    x402Version: X402_VERSION,
    scheme: "exact",
    network: req.network,
    payload: { signature, transaction: sponsored.transaction },
  };
  const headers = new Headers(init.headers);
  headers.set(PAYMENT_HEADER, encodeHeader(payload));
  const response = await http(url, { ...init, headers });
  const settleHeader = response.headers.get(PAYMENT_RESPONSE_HEADER);
  return {
    response,
    payment: {
      requirements: req,
      intent,
      settle: settleHeader ? decodeHeader<SettleResponse>(settleHeader) : null,
    },
  };
}
