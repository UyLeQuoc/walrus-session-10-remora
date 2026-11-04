/**
 * C2 (ADR-0123): what a change card's buttons do. Apply and Cancel are one call each; Sign builds
 * the transaction on the server now, the wallet signs and executes it, and the server confirms it
 * from the chain with the same checks the remora's page uses.
 */
import type { ChangeCard } from "@remora/schema";
import { useState } from "react";
import { toast } from "sonner";
import { useSignAndRun } from "@/features/funds/sign";
import { api, type Result } from "@/features/remoras/api";

const must = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

export function useChange(id: string, onDone: (change: ChangeCard) => void) {
  const run = useSignAndRun();
  const [busy, setBusy] = useState("");
  const act = async (first: string, steps: () => Promise<{ change: ChangeCard }>) => {
    setBusy(first);
    try {
      const { change } = await steps();
      onDone(change);
      if (change.status === "applied") toast.success(`Done: ${change.title}.`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy("");
    }
  };
  return {
    busy,
    apply: () => act("Applying…", async () => must(await api.applyChange(id))),
    decline: () => act("Cancelling…", async () => must(await api.declineChange(id))),
    sign: () =>
      act("Preparing it…", async () => {
        const { transaction } = must(await api.changeTx(id));
        setBusy("Sign it in your wallet…");
        const digest = await run(transaction);
        setBusy("Confirming onchain…");
        return must(await api.confirmChange(id, digest));
      }),
  };
}
