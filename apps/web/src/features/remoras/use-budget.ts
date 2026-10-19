/**
 * One budget read per remora, shared by Home, `/remoras` and the remora page (Phase 5, item 3).
 *
 * The per-owner rate limit answered 429 when Home and `/remoras` each read every remora's budget on
 * mount. A React Query key on the network and the remora id means the second page reads the first
 * page's answer instead of asking again, and a failed read is not retried in a storm.
 */
import { useQuery } from "@tanstack/react-query";
import { useNetwork } from "@/lib/network";
import { api } from "./api";

export function useBudget(remoraId: string, enabled = true) {
  const network = useNetwork();
  const query = useQuery({
    queryKey: ["remora-budget", network, remoraId],
    queryFn: async () => {
      const r = await api.budget(remoraId);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: enabled && Boolean(remoraId),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  return {
    meter: query.data?.meter ?? null,
    loading: !query.data && query.isFetching,
    error: query.error instanceof Error ? query.error.message : "",
    refresh: () => void query.refetch(),
  };
}
