import { useCallback, useState } from "react";
import { loadMe } from "@/features/me/use-me";
import { apiFetch, errorMessage } from "@/lib/api";

export function useMemoryToggle(enabled: boolean | undefined) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const toggle = useCallback(
    async (next: boolean) => {
      if (enabled === undefined || pending || next === enabled) return;
      setPending(true);
      setError("");
      try {
        const res = await apiFetch("/api/me/memory", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled: next }),
        });
        if (!res.ok) {
          setError(await errorMessage(res, "Could not change memory. Try again."));
          return;
        }
        loadMe();
      } catch {
        setError("Could not change memory. Try again.");
      } finally {
        setPending(false);
      }
    },
    [enabled, pending],
  );

  return { pending, error, toggle };
}
