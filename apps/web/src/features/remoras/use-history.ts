/**
 * N11 (ADR-0122): a remora's versions, the open version against now, and Restore. A restore that
 * touches the spending limit or the payees comes back as a transaction: the wallet signs it here and
 * the usual confirm applies it, the way Change budget does.
 */
import type { ConfigVersionDiff, RemoraView } from "@remora/schema";
import { useState } from "react";
import { useSignAndRun } from "@/features/funds/sign";
import { api, type Result } from "./api";
import { useLoad } from "./hooks";

const none: Result<ConfigVersionDiff | null> = { ok: true, data: null };

export function useConfigHistory(r: RemoraView, reload: () => void) {
  const versions = useLoad(() => api.history(r.id), [r.id, r.updatedAt]);
  const [open, setOpen] = useState<string | null>(null);
  const diff = useLoad<ConfigVersionDiff | null>(
    () => (open ? api.historyDiff(r.id, open) : Promise.resolve(none)),
    [r.id, open, r.updatedAt],
  );
  const run = useSignAndRun();

  /** Returns the sentence to show; throws the one to show when it fails. */
  const restore = async (version: string): Promise<string> => {
    const out = await api.restore(r.id, version);
    if (!out.ok) throw new Error(out.error);
    const { sign, applied } = out.data;
    if (applied.length) reload();
    if (sign) {
      const what = sign.kind === "budget" ? "spending limit" : "list of services it may pay";
      try {
        const digest = await run(sign.transaction);
        const done =
          sign.kind === "budget"
            ? await api.budgetConfirm(r.id, digest, sign.budget)
            : await api.payeesConfirm(r.id, digest, sign.payees);
        if (!done.ok) throw new Error(done.error);
      } catch (err) {
        throw new Error(
          `${applied.length ? "The other settings are back, but its" : "Its"} ${what} didn't change: ${(err as Error).message}`,
        );
      }
      reload();
    }
    void versions.refresh();
    setOpen(null);
    return applied.length || sign ? "Restored." : "Nothing to restore: it's the same as now.";
  };

  return { versions, open, setOpen, diff, restore };
}
