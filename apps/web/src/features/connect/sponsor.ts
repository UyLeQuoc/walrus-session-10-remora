/**
 * Account setup, sponsored when the relayer will sponsor it and paid by the
 * user when it will not.
 *
 * The Walrus Memory relayer sponsors exactly three calls — account::create_account,
 * add_delegate_key and remove_delegate_key — so a user can own their memory
 * without ever holding SUI. That is the path we prefer.
 *
 * It is not a path we control. On 2026-09-22 `/sponsor` began answering every
 * one of these calls with 502 sponsor_upstream_error while the same call, from
 * the same package with the same arguments, kept succeeding on mainnet for
 * other clients (docs/issues/11-sponsor-upstream-502.md has the measurements).
 * Owning your memory is the centre of this project, so it cannot rest on an
 * endpoint that can refuse us with no recourse. When sponsorship fails and the
 * wallet holds enough SUI, we fall back to an ordinary transaction the user
 * pays for, which is what memwal's own SetupWizard does.
 */

import type { Transaction } from "@mysten/sui/transactions";
import { Transaction as Tx } from "@mysten/sui/transactions";
import { createSponsorAuthorization } from "@mysten-incubation/memwal";

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

/**
 * Enough SUI to be worth attempting. These calls cost far less; the margin is
 * so a wallet holding dust does not get a confusing on-chain failure instead of
 * a clear message.
 */
const MIN_GAS_MIST = 5_000_000n; // 0.005 SUI

/** 408/429/500/503/504 are worth retrying; 502 means the sponsor rejected the transaction itself. */
function retryable(status: number): boolean {
  return status === 408 || status === 429 || status === 500 || status === 503 || status === 504;
}

type TxClient = NonNullable<Parameters<Transaction["build"]>[0]>["client"];

interface BalanceClient {
  getBalance?(input: { owner: string }): Promise<unknown>;
}

export interface SponsorDeps {
  relayerUrl: string;
  sender: string;
  suiClient: TxClient & BalanceClient;
  signTransaction: (input: { transaction: Tx }) => Promise<{ signature: string }>;
  signPersonalMessage: (input: { message: Uint8Array }) => Promise<{ signature: string }>;
  /**
   * The fallback. Optional so the sponsored path can be tested on its own, but
   * the connect page always supplies it.
   */
  signAndExecuteTransaction?: (input: { transaction: Tx }) => Promise<{ digest: string }>;
  /** Told who ended up paying, so the page can say so while it works. */
  onFallback?: (reason: string) => void;
}

export interface ExecutionResult {
  digest: string;
  paidBy: "sponsor" | "self";
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** MIST held by an address, or null when the balance cannot be read. */
function mistOf(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  if ("totalBalance" in value && typeof value.totalBalance === "string") return value.totalBalance;
  if (!("balance" in value)) return null;
  const balance = value.balance;
  if (typeof balance === "string") return balance;
  if (
    typeof balance === "object" &&
    balance !== null &&
    "balance" in balance &&
    typeof balance.balance === "string"
  ) {
    return balance.balance;
  }
  return null;
}

async function suiBalance(client: BalanceClient, owner: string): Promise<bigint | null> {
  if (typeof client.getBalance !== "function") return null;
  try {
    const mist = mistOf(await client.getBalance({ owner }));
    return mist === null ? null : BigInt(mist);
  } catch {
    return null;
  }
}

/**
 * `buildTx` rather than a Transaction, because a Transaction that has already
 * been built caches its data. The sponsored path builds one and may fail after
 * doing so, and the fallback needs a clean one to sign.
 */
export async function sponsorAndExecute(
  buildTx: () => Transaction,
  deps: SponsorDeps,
): Promise<ExecutionResult> {
  try {
    const digest = await viaSponsor(buildTx(), deps);
    return { digest, paidBy: "sponsor" };
  } catch (sponsorError) {
    const message = sponsorError instanceof Error ? sponsorError.message : "Sponsorship failed.";
    if (!deps.signAndExecuteTransaction) throw sponsorError;

    const balance = await suiBalance(deps.suiClient, deps.sender);
    if (balance !== null && balance < MIN_GAS_MIST) {
      throw new Error(
        `${message} Gas sponsorship is unavailable right now and this wallet holds no SUI to pay for the transaction itself, so it cannot go through. Try again later, or fund the wallet with about 0.01 SUI.`,
      );
    }

    deps.onFallback?.(message);
    const digest = await viaWallet(buildTx(), deps);
    return { digest, paidBy: "self" };
  }
}

async function viaWallet(transaction: Transaction, deps: SponsorDeps): Promise<string> {
  const execute = deps.signAndExecuteTransaction;
  if (!execute) throw new Error("No wallet execution available.");
  transaction.setSender(deps.sender);
  const { digest } = await execute({ transaction: transaction as Tx });
  return digest;
}

async function viaSponsor(transaction: Transaction, deps: SponsorDeps): Promise<string> {
  const kindBytes = await transaction.build({
    client: deps.suiClient,
    onlyTransactionKind: true,
  });
  const kindBase64 = toBase64(kindBytes);
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const auth = await createSponsorAuthorization(deps.sender, kindBytes, (message) =>
        deps.signPersonalMessage({ message }),
      );
      const sponsorRes = await fetch(`${deps.relayerUrl}/sponsor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionBlockKindBytes: kindBase64,
          sender: deps.sender,
          ...auth,
        }),
      });
      if (!sponsorRes.ok) {
        const body = await sponsorRes.text();
        if (!retryable(sponsorRes.status) || attempt === MAX_ATTEMPTS) {
          throw new Error(readSponsorError(sponsorRes.status, body));
        }
        throw Object.assign(new Error("retryable"), { retryable: true });
      }
      const sponsored = (await sponsorRes.json()) as { bytes: string; digest: string };

      const { signature } = await deps.signTransaction({ transaction: Tx.from(sponsored.bytes) });

      const execRes = await fetch(`${deps.relayerUrl}/sponsor/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digest: sponsored.digest, sender: deps.sender, signature }),
      });
      if (!execRes.ok) {
        const body = await execRes.text();
        if (!retryable(execRes.status) || attempt === MAX_ATTEMPTS) {
          throw new Error(readSponsorError(execRes.status, body));
        }
        throw Object.assign(new Error("retryable"), { retryable: true });
      }
      return ((await execRes.json()) as { digest: string }).digest;
    } catch (err) {
      lastError = err;
      const isRetryable = (err as { retryable?: boolean }).retryable === true;
      if (!isRetryable || attempt === MAX_ATTEMPTS) break;
      await new Promise((r) => setTimeout(r, BASE_DELAY_MS * 2 ** (attempt - 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Sponsorship failed.");
}

function readSponsorError(status: number, body: string): string {
  let detail: string | undefined;
  try {
    detail = (JSON.parse(body) as { error?: string }).error;
  } catch {
    detail = undefined;
  }
  if (status === 429) return "Too many requests right now. Wait a moment and try again.";
  if (status === 502)
    return detail ?? "The sponsor rejected this transaction. It may already have been applied.";
  if (status >= 500) return "The sponsor service is briefly unavailable. Try again in a moment.";
  return detail ?? `Sponsorship failed (${status}).`;
}
