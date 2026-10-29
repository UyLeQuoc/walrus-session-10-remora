import { useQuery } from "@tanstack/react-query";
import { useNetwork } from "@/lib/network";
import { fetchReefServices } from "./api";

/** The Reef directory for the viewer's network (the server resolves payees per network). */
export function useReefServices() {
  const network = useNetwork();
  return useQuery({
    queryKey: ["reef-services", network],
    queryFn: fetchReefServices,
    staleTime: 60_000,
  });
}
