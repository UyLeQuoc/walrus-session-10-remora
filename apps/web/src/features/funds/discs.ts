/** The owner's Discs on the session's network, read in the browser over gRPC-web (`@remora/disc-sdk`). */
import { useSuiClient } from "@mysten/dapp-kit";
import {
  type DiscConfig,
  listOwnerDiscs,
  type ObjectReader,
  type OwnedDisc,
} from "@remora/disc-sdk";
import { DEPLOYMENTS } from "@remora/schema";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Network } from "@/lib/network";

export function discConfig(network: Network): DiscConfig | null {
  const d = (
    DEPLOYMENTS as Record<
      string,
      { remoraPackageId: string | null; discRegistryId?: string | null; usdcCoinType: string }
    >
  )[network];
  if (!d?.remoraPackageId || !d.discRegistryId) return null;
  return { packageId: d.remoraPackageId, registryId: d.discRegistryId, coinType: d.usdcCoinType };
}

/** Fired after a pause, resume or issue so every Disc list refreshes. */
export const DISCS_CHANGED = "remora:discs-changed";

export function useOwnerDiscs(owner: string | null, network: Network) {
  const client = useSuiClient() as unknown as { core: ObjectReader };
  const [discs, setDiscs] = useState<OwnedDisc[] | null>(null);
  const [error, setError] = useState("");
  const cfg = useMemo(() => discConfig(network), [network]);

  const load = useCallback(async () => {
    if (!owner || !cfg) {
      setDiscs([]);
      return;
    }
    setError("");
    for (let attempt = 1; ; attempt++) {
      try {
        setDiscs(await listOwnerDiscs(client.core, cfg, owner));
        return;
      } catch {
        // The public fullnode drops a burst of reads now and then ("Failed to fetch"), often right
        // after a pause or resume: try twice more before saying so.
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1_500 * attempt));
          continue;
        }
        setError("Couldn't read your spending limits from Sui just now.");
        // A failed refresh keeps the list it had, so the limits you just saw don't vanish.
        setDiscs((prev) => prev ?? []);
        return;
      }
    }
  }, [owner, client, cfg]);

  useEffect(() => {
    void load();
    const again = () => void load();
    window.addEventListener(DISCS_CHANGED, again);
    return () => window.removeEventListener(DISCS_CHANGED, again);
  }, [load]);

  return { discs, error, reload: load, cfg };
}
