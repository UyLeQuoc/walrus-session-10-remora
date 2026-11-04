/**
 * MPP, the Payment HTTP auth scheme (draft-httpauth-payment-01, ADR-0120): a 402 carries
 * `WWW-Authenticate: Payment …` challenges, the retry carries `Authorization: Payment <credential>`, and
 * a paid answer carries `Payment-Receipt`. Values are base64url JSON without padding; the challenge's
 * `request` is JCS (RFC 8785), so its HMAC binding is the same in every implementation.
 *
 * The method is `sui` with the `charge` intent, shaped like @suimpp/mpp's so its clients can pay our
 * doors. Its `amount` is in whole units of the coin ("0.005" USDC), not base units as the charge draft
 * says: @suimpp/mpp reads it that way, and a base-unit amount would make its clients pay 10⁶ times over.
 */
import { normalizeStructTag } from "@mysten/sui/utils";
import { type PaymentRequirements, type SuiNetworkName, toX402Network } from "./x402.ts";

export const MPP_METHOD = "sui";
export const MPP_INTENT = "charge";
export const MPP_CHALLENGE_HEADER = "www-authenticate";
export const MPP_CREDENTIAL_HEADER = "authorization";
export const MPP_RECEIPT_HEADER = "payment-receipt";
/** Circle's USDC has 6 decimals. Every Remora door sells in it, and remoras pay in it. */
export const USDC_DECIMALS = 6;

/** A challenge's auth-params, echoed unchanged in the credential. `request` stays base64url. */
export interface MppChallenge {
  id: string;
  realm: string;
  method: string;
  intent: string;
  request: string;
  expires?: string;
  description?: string;
  digest?: string;
  opaque?: string;
}

/** The `sui` charge request. `methodDetails` is ours; @suimpp/mpp clients ignore it and echo it. */
export interface MppRequest {
  /** Whole units of `currency`, e.g. "0.005". */
  amount: string;
  /** Coin type. */
  currency: string;
  recipient: string;
  methodDetails?: {
    network?: SuiNetworkName;
    decimals?: number;
    /** The facilitator's gas station, as x402's `extra.gasStation`: remoras hold no SUI. */
    gasStation?: string;
    /** The payment must be a `remora::disc::pay`. */
    disc?: boolean;
  };
}

/**
 * `transaction`: the signed, sponsored transaction x402 uses; the merchant's facilitator settles it.
 * `digest`: @suimpp/mpp's, a transaction the payer already executed, with `signature` over its
 * payment-proof message.
 */
export type MppPayload =
  | { type?: "transaction"; transaction: string; signature: string }
  | { digest: string; signature: string };

export interface MppCredential {
  challenge: MppChallenge;
  /** The payer, e.g. `did:pkh:sui:testnet:0x…`. */
  source?: string;
  payload: MppPayload;
}

export interface MppReceipt {
  status: "success";
  method: string;
  timestamp: string;
  /** The transaction digest. */
  reference: string;
}

export function toBase64url(text: string): string {
  let binary = "";
  for (const b of new TextEncoder().encode(text)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Also takes padding and the standard alphabet, so a sloppy client still gets a precise error later. */
export function fromBase64url(value: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_+/-]*={0,2}$/.test(value))
    throw new Error("not base64url");
  const b64 = value.replace(/=+$/, "").replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (c) =>
    c.charCodeAt(0),
  );
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/** RFC 8785: keys sorted by UTF-16 code unit, no whitespace, ES number and string forms. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value)
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("JCS: not a number");
  return JSON.stringify(value);
}

export const encodeMppRequest = (request: unknown) => toBase64url(canonicalJson(request));
export const encodeMpp = (value: unknown) => toBase64url(JSON.stringify(value));
export const decodeMpp = <T>(value: string): T => JSON.parse(fromBase64url(value)) as T;

const quote = (v: string) => `"${v.replace(/["\\]/g, "\\$&")}"`;

export function formatChallenge(c: MppChallenge): string {
  const params: [string, string | undefined][] = [
    ["id", c.id],
    ["realm", c.realm],
    ["method", c.method],
    ["intent", c.intent],
    ["request", c.request],
    ["expires", c.expires],
    ["description", c.description],
    ["digest", c.digest],
    ["opaque", c.opaque],
  ];
  return `Payment ${params
    .filter((p): p is [string, string] => p[1] !== undefined)
    .map(([k, v]) => `${k}=${quote(v)}`)
    .join(", ")}`;
}

const TOKEN = /[!#$%&'*+.^_`|~0-9A-Za-z-]/;
const KNOWN = [
  "id",
  "realm",
  "method",
  "intent",
  "request",
  "expires",
  "description",
  "digest",
  "opaque",
];

/** Every `Payment` challenge in a `WWW-Authenticate` value; other schemes and unknown params are skipped. */
export function parseChallenges(header: string | null | undefined): MppChallenge[] {
  const s = header ?? "";
  const found: Record<string, string>[] = [];
  let current: Record<string, string> | null = null;
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /[\s,]/.test(s.charAt(i))) i++;
    const start = i;
    while (i < s.length && TOKEN.test(s.charAt(i))) i++;
    const name = s.slice(start, i);
    if (!name) {
      i++;
      continue;
    }
    let j = i;
    while (s.charAt(j) === " " || s.charAt(j) === "\t") j++;
    if (s.charAt(j) !== "=") {
      current = name.toLowerCase() === "payment" ? {} : null;
      if (current) found.push(current);
      continue;
    }
    i = j + 1;
    while (s.charAt(i) === " " || s.charAt(i) === "\t") i++;
    let value = "";
    if (s.charAt(i) === '"') {
      i++;
      while (i < s.length && s.charAt(i) !== '"') {
        if (s.charAt(i) === "\\") i++;
        value += s.charAt(i);
        i++;
      }
      i++;
    } else {
      const from = i;
      while (i < s.length && s.charAt(i) !== "," && !/\s/.test(s.charAt(i))) i++;
      value = s.slice(from, i);
    }
    const key = name.toLowerCase();
    if (current && KNOWN.includes(key) && !(key in current)) current[key] = value;
  }
  return found.filter(
    (c): c is Record<string, string> & MppChallenge =>
      !!c.id && !!c.realm && !!c.method && !!c.intent && !!c.request,
  );
}

/** The base64url tokens of every `Payment` credential in an `Authorization` value. */
export function paymentCredentials(header: string | null | undefined): string[] {
  return (header ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^Payment\s+\S/i.test(s))
    .map((s) => s.replace(/^Payment\s+/i, ""));
}

export function toWholeUnits(raw: bigint, decimals: number): string {
  const digits = raw.toString().padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

/** Null for anything but a plain decimal with at most `decimals` places. */
export function fromWholeUnits(amount: string, decimals: number): bigint | null {
  const m = /^(\d*)(?:\.(\d+))?$/.exec(amount);
  if (!m || (!m[1] && !m[2]) || (m[2]?.length ?? 0) > decimals) return null;
  return BigInt(`${m[1] || "0"}${(m[2] ?? "").padEnd(decimals, "0")}`);
}

export const sameCoinType = (a: string, b: string) => {
  try {
    return normalizeStructTag(a) === normalizeStructTag(b);
  } catch {
    return a === b;
  }
};

/** The network a credential's challenge was issued for, from its request; null if unreadable. */
export function mppNetwork(authorization: string | null | undefined): SuiNetworkName | null {
  const [token] = paymentCredentials(authorization);
  if (!token) return null;
  try {
    const credential = decodeMpp<MppCredential>(token);
    const network = decodeMpp<MppRequest>(credential.challenge.request).methodDetails?.network;
    return network === "testnet" || network === "mainnet" ? network : null;
  } catch {
    return null;
  }
}

/**
 * The first payable `sui` charge challenge for this network and coin, with the x402 requirements that
 * pay it, so `disc.fetch` builds the same Disc payment for both. Expired challenges are skipped.
 */
export function mppRequirements(
  challenges: MppChallenge[],
  o: { network: SuiNetworkName; coinType: string; resource: string; now?: number },
): { challenge: MppChallenge; requirements: PaymentRequirements } | null {
  const now = o.now ?? Date.now();
  for (const challenge of challenges) {
    if (challenge.method !== MPP_METHOD || challenge.intent !== MPP_INTENT) continue;
    const expiresAt = challenge.expires ? Date.parse(challenge.expires) : Number.POSITIVE_INFINITY;
    if (!(expiresAt > now)) continue;
    let r: MppRequest;
    try {
      r = decodeMpp<MppRequest>(challenge.request);
    } catch {
      continue;
    }
    if (typeof r?.amount !== "string" || typeof r.currency !== "string") continue;
    if (typeof r.recipient !== "string") continue;
    const d = r.methodDetails;
    if (d?.network !== undefined && d.network !== o.network) continue;
    if (d?.decimals !== undefined && d.decimals !== USDC_DECIMALS) continue;
    if (!sameCoinType(r.currency, o.coinType)) continue;
    const amount = fromWholeUnits(r.amount, USDC_DECIMALS);
    if (!amount) continue;
    return {
      challenge,
      requirements: {
        scheme: "exact",
        network: toX402Network(o.network),
        amount: amount.toString(),
        asset: r.currency,
        payTo: r.recipient,
        maxTimeoutSeconds: Number.isFinite(expiresAt)
          ? Math.max(1, Math.floor((expiresAt - now) / 1000))
          : 60,
        resource: o.resource,
        ...(challenge.description ? { description: challenge.description } : {}),
        extra: {
          ...(typeof d?.gasStation === "string" ? { gasStation: d.gasStation } : {}),
          ...(d?.disc ? { disc: true } : {}),
        },
      },
    };
  }
  return null;
}
