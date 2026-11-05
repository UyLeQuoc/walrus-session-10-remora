/**
 * U19 B1 (ADR-0145): the auditor's page logic. Load the public access record, then with the connected
 * wallet: sign a Seal session key, fetch the sealed bundle from Walrus, decrypt it in this browser,
 * parse it as data, and check every paid Wake against its transaction read from Sui over gRPC-web.
 */
import { useCurrentAccount, useSignPersonalMessage, useSuiClient } from "@mysten/dapp-kit";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { type AuditAccess, AuditBundle } from "@remora/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { currentNetwork, setNetwork } from "@/lib/network";
import { capsuleSealClient, decryptCapsuleBlob, walletSession } from "@/lib/seal";
import { auditApi } from "./api";
import {
  checkReceipt,
  type ReceiptCheck,
  readBundleBlob,
  receiptsOf,
  refusalOf,
  type TxRead,
} from "./checks";

export type AuditState =
  | { phase: "loading" }
  | { phase: "missing"; message: string }
  | { phase: "ready" }
  | { phase: "opening"; step: string }
  | { phase: "refused"; message: string }
  | { phase: "failed"; message: string }
  | { phase: "open"; bundle: AuditBundle; results: (ReceiptCheck | null)[] };

/** Reads one transaction the way the checks need it. */
export async function readTx(sui: ClientWithCoreApi, digest: string): Promise<TxRead | null> {
  try {
    const res = await sui.core.getTransaction({
      digest,
      include: { effects: true, events: true, balanceChanges: true, transaction: true },
    });
    const tx = res.Transaction ?? res.FailedTransaction;
    return {
      success: !!tx.effects?.status.success,
      sender: tx.transaction?.sender ?? null,
      events: (tx.events ?? []).map((e) => ({ eventType: e.eventType, bcs: e.bcs })),
      balanceChanges: (tx.balanceChanges ?? []).map((b) => ({
        address: b.address,
        coinType: b.coinType,
        amount: String(b.amount),
      })),
    };
  } catch {
    return null;
  }
}

/** Every paid Wake checked, four reads at a time; `onEach` sees each result as it lands. */
export async function checkAll(
  bundle: AuditBundle,
  read: (digest: string) => Promise<TxRead | null>,
  onEach: (results: (ReceiptCheck | null)[]) => void,
): Promise<ReceiptCheck[]> {
  const paid = receiptsOf(bundle);
  const results: (ReceiptCheck | null)[] = paid.map(() => null);
  let next = 0;
  const worker = async () => {
    while (next < paid.length) {
      const i = next++;
      const w = paid[i];
      if (!w?.payment) continue;
      results[i] = checkReceipt(w, await read(w.payment.digest), bundle.remora.network);
      onEach([...results]);
    }
  };
  await Promise.all([0, 1, 2, 3].map(worker));
  return results as ReceiptCheck[];
}

const sentence = (err: unknown) => {
  const message = err instanceof Error ? err.message : "";
  if (/rejected|denied by user|cancel/i.test(message)) return "The wallet request was declined.";
  return message.slice(0, 200) || "Couldn't open the bundle just now.";
};

export function useAudit(capsuleId: string) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [access, setAccess] = useState<AuditAccess | null>(null);
  const [state, setState] = useState<AuditState>({ phase: "loading" });
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  useEffect(() => {
    setState({ phase: "loading" });
    void auditApi.access(capsuleId).then((r) => {
      if (!live.current) return;
      if (!r.ok) return setState({ phase: "missing", message: r.error });
      setAccess(r.data);
      // The capsule, its receipts and their anchors live on this network.
      if (r.data.network !== currentNetwork()) setNetwork(r.data.network);
      setState({ phase: "ready" });
    });
  }, [capsuleId]);

  const open = useCallback(async () => {
    if (!access || !account) return;
    if (!("core" in client)) {
      setState({ phase: "failed", message: "This Sui client can't read the chain." });
      return;
    }
    const sui = client as unknown as ClientWithCoreApi;
    try {
      setState({ phase: "opening", step: "Sign in your wallet…" });
      const session = await walletSession({
        sui,
        address: account.address,
        packageId: access.packageId,
        signPersonalMessage: async (message) => (await signPersonalMessage({ message })).signature,
      });
      setState({ phase: "opening", step: "Fetching the sealed bundle from Walrus…" });
      const ciphertext = await readBundleBlob(access.blobId, access.network);
      setState({ phase: "opening", step: "Asking the key servers…" });
      const plain = await decryptCapsuleBlob({
        seal: capsuleSealClient(sui),
        sui,
        packageId: access.packageId,
        capsuleId: access.capsuleId,
        session,
        ciphertext,
      });
      let json: unknown;
      try {
        json = JSON.parse(new TextDecoder().decode(plain));
      } catch {
        throw new Error("The bundle isn't JSON.");
      }
      const parsed = AuditBundle.safeParse(json);
      if (!parsed.success) throw new Error("The bundle isn't in the shape this page reads.");
      const bundle = parsed.data;
      const empty = receiptsOf(bundle).map(() => null);
      if (!live.current) return;
      setState({ phase: "open", bundle, results: empty });
      await checkAll(
        bundle,
        (digest) => readTx(sui, digest),
        (results) => {
          if (live.current) setState({ phase: "open", bundle, results });
        },
      );
    } catch (err) {
      if (!live.current) return;
      const refused = refusalOf(err);
      setState(
        refused
          ? { phase: "refused", message: refused }
          : { phase: "failed", message: sentence(err) },
      );
    }
  }, [access, account, client, signPersonalMessage]);

  return { access, state, open, address: account?.address ?? null };
}
