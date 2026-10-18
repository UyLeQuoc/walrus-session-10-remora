import { useEffect, useSyncExternalStore } from "react";
import { apiGet } from "@/lib/api-request";
import { type NetworksResponse, NetworksResponse as Schema } from "@/lib/contracts";
import { type Network, setNetwork, useNetwork } from "@/lib/network";

/** `GET /api/networks`, fetched once per page load and shared. */
let state: NetworksResponse | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load(): Promise<void> {
  inflight ??= apiGet("/api/networks", Schema, "Couldn't load networks.").then((r) => {
    if (r.ok) {
      state = r.data;
      for (const l of listeners) l();
    } else {
      inflight = null; // try again on the next mount
    }
  });
  return inflight;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The networks and the rule that the session never sits on an unavailable one. */
export function useNetworks() {
  const network = useNetwork();
  const data = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!data) return;
    const mine = data.networks.find((n) => n.network === network);
    if (!mine?.available) setNetwork(data.default as Network);
  }, [data, network]);
  return { network, networks: data?.networks ?? [] };
}

/** Tests only. */
export function resetNetworksForTest(): void {
  state = null;
  inflight = null;
}
