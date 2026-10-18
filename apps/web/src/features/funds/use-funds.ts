import { useCallback, useEffect, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/api";
import { type DetectFundsResponse, DetectFundsResponse as Schema } from "@/lib/contracts";
import { NETWORK_HEADER, type Network } from "@/lib/network";

/** A4·ui: Detect funds for the owner on a given network (sent explicitly, so a switch refetches). */
export function useFunds(owner: string | null, network: Network) {
  const [data, setData] = useState<DetectFundsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const detect = useCallback(async (): Promise<DetectFundsResponse | null> => {
    if (!owner) return null;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/funds?owner=${owner}`, {
        headers: { [NETWORK_HEADER]: network },
      });
      if (!res.ok) {
        setError(await errorMessage(res, "Couldn't read your balances."));
        return null;
      }
      const parsed = Schema.safeParse(await res.json());
      if (!parsed.success) {
        setError("Couldn't read your balances.");
        return null;
      }
      setData(parsed.data);
      setError("");
      return parsed.data;
    } catch {
      setError("Couldn't read your balances.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [owner, network]);

  useEffect(() => {
    setData(null);
    void detect();
  }, [detect]);

  return { data, error, loading, detect };
}
