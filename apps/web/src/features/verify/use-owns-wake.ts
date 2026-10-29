import { useQuery } from "@tanstack/react-query";
import { api } from "@/features/remoras/api";
import { useOwner } from "@/features/remoras/hooks";

/**
 * Does the signed-in owner own the remora behind this Wake? A Wake carries no owner (and must not),
 * so ownership is known by matching the Wake's signing address (`agent`, one key per remora) against
 * the owner's own remoras (`GET /api/remoras` is session-scoped). Signed out, or no match: false. This only
 * decides whether to show the Share controls; the server enforces "owner only" on the endpoint.
 */
export function useOwnsWake(agent: string | undefined): boolean {
  const { owner } = useOwner();
  const query = useQuery({
    queryKey: ["owns-wake-remoras", owner],
    queryFn: async () => {
      const r = await api.remoras();
      return r.ok ? r.data.remoras : [];
    },
    enabled: Boolean(owner && agent),
    staleTime: 60_000,
  });
  if (!owner || !agent) return false;
  return Boolean(query.data?.some((x) => x.address?.toLowerCase() === agent.toLowerCase()));
}
