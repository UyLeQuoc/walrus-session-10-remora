/**
 * ADR-0139: the browser rechecks a Merkle anchor itself instead of taking the server's word. It
 * hashes the Wake it was shown, walks the proof to the root, then reads the transaction from Sui over
 * gRPC-web and looks for our `remora_anchor` package's `Anchored` event with that root.
 */
import { useSuiClient } from "@mysten/dapp-kit";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { type AnchoredEvent, anchoredEvents } from "@remora/disc-sdk";
import {
  type AnchorProof,
  DEPLOYMENTS,
  verifyMerkleProof,
  type Wake,
  wakeLeaf,
} from "@remora/schema";
import { useEffect, useRef, useState } from "react";
import { useNetwork } from "@/lib/network";

export type AnchorCheck =
  | { state: "checking"; proofOk: boolean }
  | {
      state: "done";
      proofOk: boolean;
      /** The `Anchored` event with this root, if the transaction has one. */
      event: AnchoredEvent | null;
      byRemora: boolean;
    }
  | { state: "error"; proofOk: boolean; message: string };

/** The Wake as shown, hashed here, reaches the anchored root through the proof. */
export const proofHolds = (wake: Wake, a: AnchorProof) =>
  verifyMerkleProof(wakeLeaf(wake), a.proof, a.root);

/** Our package's `Anchored` event with this root and count, from the transaction's events. */
export function anchorEventOf(
  a: AnchorProof,
  events: { eventType: string; bcs: Uint8Array }[] | null | undefined,
): AnchoredEvent | null {
  const ours = DEPLOYMENTS[a.network].anchorPackageId;
  if (!ours || normalizeSuiAddress(ours) !== normalizeSuiAddress(a.packageId)) return null;
  return anchoredEvents(ours, events).find((e) => e.root === a.root && e.count === a.count) ?? null;
}

export function useAnchorCheck(wake: Wake, anchor: AnchorProof | null): AnchorCheck | null {
  // Read through a ref: a test's (or a provider's) new client object mustn't restart the read.
  const client = useRef(useSuiClient());
  const network = useNetwork();
  const [check, setCheck] = useState<AnchorCheck | null>(null);
  useEffect(() => {
    if (!anchor) {
      setCheck(null);
      return;
    }
    const proofOk = proofHolds(wake, anchor);
    if (anchor.network !== network) {
      setCheck({
        state: "error",
        proofOk,
        message: `Switch to ${anchor.network} to read the root from Sui.`,
      });
      return;
    }
    if (!("core" in client.current)) {
      setCheck({ state: "error", proofOk, message: "This Sui client can't read transactions." });
      return;
    }
    let live = true;
    setCheck({ state: "checking", proofOk });
    (client.current as unknown as ClientWithCoreApi).core
      .getTransaction({ digest: anchor.digest, include: { effects: true, events: true } })
      .then((res) => {
        const tx = res.Transaction ?? res.FailedTransaction;
        const event = tx.effects?.status.success ? anchorEventOf(anchor, tx.events) : null;
        if (live)
          setCheck({
            state: "done",
            proofOk,
            event,
            byRemora: !!event && event.anchorer === normalizeSuiAddress(wake.agent),
          });
      })
      .catch(() => {
        if (live)
          setCheck({
            state: "error",
            proofOk,
            message: "Couldn't read that transaction from Sui.",
          });
      });
    return () => {
      live = false;
    };
  }, [network, wake, anchor]);
  return check;
}
