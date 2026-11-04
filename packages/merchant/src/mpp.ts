/**
 * ADR-0120: the server half of MPP for `x402()`, so every x402 door also speaks the Payment HTTP auth
 * scheme (draft-httpauth-payment-01). Every 402 carries one `sui` charge challenge per network, and
 * `Authorization: Payment <credential>` pays it.
 *
 * - **Challenges** are HMAC-bound to realm, method, intent, request, expiry and a random nonce in
 *   `opaque` (draft §5.1.2.1.1), single-use, and expire after `ttlSeconds`. The nonce keeps two
 *   challenges for the same price in the same second apart. Without `secret` the key is random per
 *   process, so a restart only voids open challenges: the client gets a fresh 402.
 * - **A signed transaction** (`payload.transaction`, what `disc.fetch` sends) goes to the door's
 *   facilitator exactly as x402's does (`x402.ts`).
 * - **A digest** (`payload.digest`, what @suimpp/mpp sends after executing the payment itself) is read
 *   over gRPC here (`checkDigest`).
 * - Errors are Problem Details with a fresh challenge. A `Payment-Receipt` rides a 2xx only.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { isValidTransactionDigest, normalizeSuiAddress } from "@mysten/sui/utils";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";
import {
  decodeMpp,
  encodeMpp,
  encodeMppRequest,
  formatChallenge,
  fromWholeUnits,
  MPP_CREDENTIAL_HEADER,
  MPP_INTENT,
  MPP_METHOD,
  MPP_RECEIPT_HEADER,
  type MppChallenge,
  type MppCredential,
  type MppReceipt,
  type MppRequest,
  paymentCredentials,
  type SuiNetworkName,
  sameCoinType,
  toWholeUnits,
  USDC_DECIMALS,
} from "@remora/disc-sdk";
import type { Context } from "hono";
import type { DoorNetwork, X402Options } from "./x402.ts";

export interface MppOptions {
  /** HMAC key for challenge ids. Doors that share it accept each other's challenges for the same price. */
  secret?: string;
  /** Defaults to the request's host. */
  realm?: string;
  /** How long a challenge stays payable. Defaults to 300. */
  ttlSeconds?: number;
}

const TITLES = {
  "malformed-credential": "Malformed Credential",
  "invalid-challenge": "Invalid Challenge",
  "payment-expired": "Payment Expired",
  "invalid-payload": "Invalid Payload",
  "verification-failed": "Verification Failed",
  "bad-request": "Bad Request",
} as const;
export type MppProblem = keyof typeof TITLES;

const PROCESS_SECRET = randomBytes(32).toString("base64url");
/** Challenge ids already presented, until they expire (draft §11.3). Shared by every door in the process. */
const usedChallenges = new Map<string, number>();
/** Digests that already paid for a call, for a day. */
const usedDigests = new Map<string, number>();
/** A transaction executed this long before its challenge was issued still counts (clock skew). */
const SKEW_MS = 60_000;

function once(seen: Map<string, number>, key: string, until: number): boolean {
  const now = Date.now();
  for (const [k, exp] of seen) if (exp <= now) seen.delete(k);
  if (seen.has(key)) return false;
  seen.set(key, until);
  return true;
}

const rfc3339 = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const text = (v: unknown) => (typeof v === "string" ? v : undefined);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
/** The spec echoes `opaque` as we sent it; mppx's clients echo it decoded, as an object. */
const opaqueOf = (v: unknown) =>
  typeof v === "string" ? v : isObject(v) ? encodeMppRequest(v) : undefined;

/** Draft §5.1.2.1.1: base64url(HMAC-SHA256(secret, realm|method|intent|request|expires|digest|opaque)). */
export function challengeId(
  secret: string,
  c: Pick<
    MppChallenge,
    "realm" | "method" | "intent" | "request" | "expires" | "digest" | "opaque"
  >,
): string {
  const input = [
    c.realm,
    c.method,
    c.intent,
    c.request,
    c.expires ?? "",
    c.digest ?? "",
    c.opaque ?? "",
  ].join("|");
  return createHmac("sha256", secret).update(input).digest("base64url");
}

function sameId(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function isCredential(v: unknown): v is MppCredential {
  if (!isObject(v) || !isObject(v.challenge) || !isObject(v.payload)) return false;
  const c = v.challenge;
  return [c.id, c.realm, c.method, c.intent, c.request].every((x) => typeof x === "string");
}

export type MppRead =
  | { kind: "none" }
  | { kind: "many" }
  | { kind: "malformed"; detail: string }
  | { kind: "one"; credential: MppCredential };

export type MppAccepted =
  | {
      ok: true;
      network: SuiNetworkName;
      n: DoorNetwork;
      request: MppRequest;
      /** When the challenge was issued: a digest's transaction must not be older. */
      issuedAt: number;
    }
  | { ok: false; problem: MppProblem; detail: string };

export function mppDoor(o: X402Options, m: MppOptions) {
  const secret = m.secret || PROCESS_SECRET;
  const ttlMs = (m.ttlSeconds ?? 300) * 1000;
  const realmOf = (c: Context) => m.realm ?? new URL(c.req.url).host;
  const offers = () =>
    Object.entries(o.networks).filter((e): e is [SuiNetworkName, DoorNetwork] => !!e[1]);
  const requestFor = (network: SuiNetworkName, n: DoorNetwork): MppRequest => ({
    amount: toWholeUnits(BigInt(o.amount), n.decimals ?? USDC_DECIMALS),
    currency: n.asset,
    recipient: n.payTo,
    methodDetails: {
      network,
      decimals: n.decimals ?? USDC_DECIMALS,
      gasStation: `${n.facilitatorUrl.replace(/\/$/, "")}/gas`,
      ...(o.disc ? { disc: true } : {}),
    },
  });

  const challenges = (c: Context): MppChallenge[] => {
    const realm = realmOf(c);
    const expires = rfc3339(Date.now() + ttlMs);
    return offers().map(([network, n]) => {
      const bound = {
        realm,
        method: MPP_METHOD,
        intent: MPP_INTENT,
        request: encodeMppRequest(requestFor(network, n)),
        expires,
        opaque: encodeMppRequest({ nonce: randomBytes(12).toString("base64url") }),
      };
      return {
        id: challengeId(secret, bound),
        ...bound,
        ...(o.description ? { description: o.description } : {}),
      };
    });
  };
  const challengeHeader = (fresh: MppChallenge[]): Record<string, string> =>
    fresh.length ? { "www-authenticate": fresh.map(formatChallenge).join(", ") } : {};

  return {
    /** What every 402 carries besides x402's body (draft §5.1, §11.10). */
    headers(c: Context): Record<string, string> {
      return { ...challengeHeader(challenges(c)), "cache-control": "no-store" };
    },

    /** Only `Authorization` can carry the credential (no challenge selects `Payment-Authorization`). */
    read(c: Context): MppRead {
      const here = paymentCredentials(c.req.header(MPP_CREDENTIAL_HEADER));
      const elsewhere = paymentCredentials(c.req.header("payment-authorization"));
      if (here.length + elsewhere.length > 1) return { kind: "many" };
      const [token] = here;
      if (!token) return { kind: "none" };
      let value: unknown;
      try {
        value = decodeMpp(token);
      } catch {
        return { kind: "malformed", detail: "The credential isn't base64url JSON." };
      }
      if (!isCredential(value))
        return {
          kind: "malformed",
          detail:
            "The credential needs a challenge (id, realm, method, intent, request) and a payload.",
        };
      return { kind: "one", credential: value };
    },

    /** Binding, expiry, payload shape, then single use: a challenge is spent once it gets this far. */
    accept(c: Context, credential: MppCredential): MppAccepted {
      const no = (problem: MppProblem, detail: string) => ({ ok: false as const, problem, detail });
      const ch = credential.challenge;
      if (ch.method !== MPP_METHOD || ch.intent !== MPP_INTENT)
        return no("invalid-challenge", `This door takes method "${MPP_METHOD}", intent "charge".`);
      const realm = realmOf(c);
      if (ch.realm !== realm)
        return no("invalid-challenge", "That challenge is for another realm.");
      let request: string;
      try {
        request = encodeMppRequest(decodeMpp(ch.request));
      } catch {
        return no("invalid-challenge", "The challenge's request isn't base64url JSON.");
      }
      const offer = offers().find(([net, n]) => encodeMppRequest(requestFor(net, n)) === request);
      if (!offer)
        return no(
          "invalid-challenge",
          "The challenge doesn't match this door's price, coin or payee.",
        );
      const expires = text(ch.expires);
      const id = challengeId(secret, {
        realm,
        method: ch.method,
        intent: ch.intent,
        request,
        expires,
        digest: text(ch.digest),
        opaque: opaqueOf(ch.opaque),
      });
      if (!sameId(id, ch.id))
        return no("invalid-challenge", "This door didn't issue that challenge.");
      const expiresAt = Date.parse(expires ?? "");
      if (!(expiresAt > Date.now()))
        return no("payment-expired", "The challenge expired. Pay the fresh one.");
      const p = credential.payload as unknown as Record<string, unknown>;
      const shaped =
        typeof p.signature === "string" &&
        ((typeof p.transaction === "string" && (p.type ?? "transaction") === "transaction") ||
          typeof p.digest === "string");
      if (!shaped)
        return no(
          "invalid-payload",
          "Send a signed transaction ({transaction, signature}) or a digest ({digest, signature}).",
        );
      if (!once(usedChallenges, ch.id, expiresAt))
        return no("invalid-challenge", "That challenge was already used.");
      const [network, n] = offer;
      return { ok: true, network, n, request: requestFor(network, n), issuedAt: expiresAt - ttlMs };
    },

    /** A Problem Details answer; a 402 also carries fresh challenges. */
    refuse(c: Context, problem: MppProblem, detail: string, status: 400 | 402 = 402): Response {
      const fresh = status === 402 ? challenges(c) : [];
      const body = {
        type: `https://paymentauth.org/problems/${problem}`,
        title: TITLES[problem],
        status,
        detail,
        ...(fresh[0] ? { challengeId: fresh[0].id } : {}),
      };
      return c.body(JSON.stringify(body), status, {
        "content-type": "application/problem+json",
        "cache-control": "no-store",
        ...challengeHeader(fresh),
      });
    },

    /** Call on a 2xx only (draft §5.3.1). */
    receipt(c: Context, reference: string) {
      const receipt: MppReceipt = {
        status: "success",
        method: MPP_METHOD,
        timestamp: new Date().toISOString(),
        reference,
      };
      c.header(MPP_RECEIPT_HEADER, encodeMpp(receipt));
      c.header("cache-control", "private");
    },
  };
}

/** @suimpp/mpp's payment proof: its client signs this personal message with the paying key. */
export function suiPaymentProof(
  challenge: Pick<MppChallenge, "id" | "method" | "intent">,
  request: Pick<MppRequest, "amount" | "currency" | "recipient">,
  digest: string,
): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      domain: "suimpp.sui.payment-proof",
      version: 1,
      method: challenge.method,
      intent: challenge.intent,
      challengeId: challenge.id,
      amount: request.amount,
      currency: request.currency,
      recipient: request.recipient,
      digest,
    }),
  );
}

/**
 * Push mode (@suimpp/mpp's credential): the payer already executed the payment. The transaction must
 * have succeeded, credited the recipient at least the amount in the coin, executed after the challenge
 * was issued (so an old payment can't buy a new call after a restart empties the digest set), be
 * signed for this challenge by its sender (the proof), and never have paid before.
 */
export async function checkDigest(
  client: ClientWithCoreApi,
  a: {
    challenge: MppChallenge;
    request: MppRequest;
    issuedAt: number;
    digest: string;
    signature: string;
  },
): Promise<{ ok: true; payer: string } | { ok: false; detail: string }> {
  const no = (detail: string) => ({ ok: false as const, detail });
  if (!isValidTransactionDigest(a.digest)) return no("That isn't a transaction digest.");
  if (usedDigests.has(a.digest)) return no("That transaction already paid for a call.");
  const tx = await client.core
    .waitForTransaction({
      digest: a.digest,
      include: { balanceChanges: true, transaction: true },
      timeout: 10_000,
    })
    .then(
      (res) => res.Transaction ?? res.FailedTransaction,
      () => null,
    );
  if (!tx) return no(`Couldn't find transaction ${a.digest}.`);
  if (!tx.status.success) return no("The transaction failed onchain.");
  if (tx.timestampMs !== null && tx.timestampMs < a.issuedAt - SKEW_MS)
    return no("The transaction is older than the challenge.");
  const want = fromWholeUnits(a.request.amount, a.request.methodDetails?.decimals ?? USDC_DECIMALS);
  const recipient = normalizeSuiAddress(a.request.recipient);
  const credited = (tx.balanceChanges ?? [])
    .filter(
      (b) =>
        normalizeSuiAddress(b.address) === recipient &&
        sameCoinType(b.coinType, a.request.currency),
    )
    .reduce((sum, b) => sum + BigInt(b.amount), 0n);
  if (want === null || credited < want)
    return no(`It credited ${credited} to the payee, short of ${want ?? "the price"}.`);
  const sender = tx.transaction?.sender;
  if (!sender) return no("The transaction has no sender.");
  try {
    await verifyPersonalMessageSignature(
      suiPaymentProof(a.challenge, a.request, a.digest),
      a.signature,
      { client, address: sender },
    );
  } catch {
    return no("The payment proof isn't signed by the transaction's sender for this challenge.");
  }
  if (!once(usedDigests, a.digest, Date.now() + 86_400_000))
    return no("That transaction already paid for a call.");
  return { ok: true, payer: normalizeSuiAddress(sender) };
}
