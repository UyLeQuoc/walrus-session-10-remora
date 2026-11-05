/** A3 (ADR-0147): the Tidied tab's data and actions: tidy now, and settle a conflict. */
import { useState } from "react";
import { useLoad } from "@/features/remoras/hooks";
import { memoryApi } from "./memory-api";

export function useTidy(remoraId: string) {
  const view = useLoad(
    () =>
      remoraId
        ? memoryApi.tidy(remoraId)
        : Promise.resolve({ ok: true as const, data: { runs: [], conflicts: [] } }),
    [remoraId],
  );
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(key);
    setError("");
    const out = await fn();
    setBusy("");
    if (!out.ok) {
      setError(out.error ?? "Something went wrong.");
      return false;
    }
    void view.refresh();
    return true;
  };

  const tidyNow = async () => {
    setBusy("tidy");
    setError("");
    const out = await memoryApi.tidyNow(remoraId);
    setBusy("");
    if (!out.ok) return setError(out.error);
    setNote(out.data.note);
    void view.refresh();
  };

  return {
    data: view.data,
    loading: view.loading,
    loadError: view.error,
    refresh: view.refresh,
    busy,
    note,
    error,
    tidyNow,
    resolve: (id: string, keep: "a" | "b") =>
      run(`${id}:${keep}`, () => memoryApi.resolveConflict(id, keep)),
    dismiss: (id: string) => run(`${id}:dismiss`, () => memoryApi.dismissConflict(id)),
  };
}
