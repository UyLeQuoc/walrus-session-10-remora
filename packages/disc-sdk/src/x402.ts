/**
 * x402 `exact` on Sui (tech-reference §3.2): the shapes the client (`disc.fetch`), the merchant
 * middleware and the facilitator exchange. Headers carry base64(JSON).
 */
export type SuiNetworkName = "testnet" | "mainnet";
export type X402Network = `sui:${SuiNetworkName}`;

export const X402_VERSION = 1;
export const PAYMENT_HEADER = "x-payment";
export const PAYMENT_RESPONSE_HEADER = "x-payment-response";

export interface PaymentRequirements {
  scheme: "exact";
  network: X402Network;
  /** Smallest units of `asset`. */
  amount: string;
  /** Coin type, e.g. USDC. */
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  resource?: string;
  description?: string;
  extra?: {
    /** Builds a sponsored transaction from a gasless one (the facilitator's `/gas`). */
    gasStation?: string;
    /** Disc-aware: the payment must be a `remora::disc::pay` with a `Paid` event. */
    disc?: boolean;
  };
}

export interface PaymentRequired {
  x402Version: number;
  accepts: PaymentRequirements[];
  error?: string;
}

export interface PaymentPayload {
  x402Version: number;
  scheme: "exact";
  network: X402Network;
  /** The client signs the complete transaction, so the facilitator can't redirect funds. */
  payload: { signature: string; transaction: string };
}

export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
  /** Hex `Paid.intent` seen in the simulation (Disc-aware mode). */
  intent?: string;
}

export interface SettleResponse {
  success: boolean;
  network: X402Network;
  transaction?: string;
  payer?: string;
  errorReason?: string;
}

export const toX402Network = (n: SuiNetworkName): X402Network => `sui:${n}`;

export function fromX402Network(n: string): SuiNetworkName | null {
  return n === "sui:testnet" ? "testnet" : n === "sui:mainnet" ? "mainnet" : null;
}

export function encodeHeader(value: unknown): string {
  // btoa exists in browsers and Node ≥ 16; encode UTF-8 first so non-ASCII survives.
  let binary = "";
  for (const b of new TextEncoder().encode(JSON.stringify(value))) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function decodeHeader<T>(header: string): T {
  const bytes = Uint8Array.from(atob(header), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
