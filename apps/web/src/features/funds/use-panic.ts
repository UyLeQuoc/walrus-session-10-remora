/**
 * N10 / E1: one panic path. The server pauses every remora and its Disc; this hook then pauses any
 * remaining live Disc that is not attached to a remora (the E2E burner's own Disc, or one issued
 * outside Remora), because `api.panic` does not cover those. One signature flow, one toast.
 */
import { useCurrentAccount } from "@mysten/dapp-kit";
import { buildPause } from "@remora/disc-sdk";
import { useState } from "react";
import { api } from "@/features/remoras/api";
import { useLoad, useOwner } from "@/features/remoras/hooks";
import { useNetwork } from "@/lib/network";
import { DISCS_CHANGED, useOwnerDiscs } from "./discs";
import { useSignAndRun } from "./sign";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function usePanic() {
  const network = useNetwork();
  const account = useCurrentAccount();
  const { owner } = useOwner();
  const address = account?.address ?? owner;
  const { discs, cfg, reload } = useOwnerDiscs(address, network);
  const remoras = useLoad(
    () =>
      owner
        ? api.remoras()
        : Promise.resolve({ ok: true as const, data: { remoras: [] as never[] } }),
    [owner],
    30_000,
  );
  const run = useSignAndRun();
  const [busy, setBusy] = useState(false);

  const rows = remoras.data?.remoras ?? [];
  const remoraCount = rows.filter((r) => r.status !== "retired" && r.discId).length;
  const live = (discs ?? []).filter((d) => !d.disc.paused);
  const discCount = live.length;

  const panic = async (): Promise<string> => {
    if (!owner) throw new Error("Sign in first.");
    if (!remoraCount && !discCount) return "Nothing to pause: every Disc is already paused.";
    setBusy(true);
    try {
      let pausedRemoras = 0;
      let serverDiscs = 0;
      // The server pauses remoras and their Discs. If one of its remora Discs is already gone
      // (e.g. revoked by global setup), it fails: fall back to pausing the live Discs directly.
      let serverFailed = false;
      try {
        const out = await api.panic();
        if (!out.ok) throw new Error(out.error);
        if (out.data.transaction) {
          const digest = await run(out.data.transaction);
          const done = await api.panicConfirm(digest);
          if (!done.ok) throw new Error(done.error);
          pausedRemoras = done.data.paused.length;
          serverDiscs = out.data.discs;
        }
      } catch {
        serverFailed = true;
      }

      const covered = new Set(rows.map((r) => r.discId).filter(Boolean));
      const rest = serverFailed ? live : live.filter((d) => !covered.has(d.disc.id));
      if (rest.length > 0) {
        if (!cfg) throw new Error("Remora isn't published on this network yet.");
        await run(
          buildPause(
            cfg,
            rest.map((d) => d.disc.id),
            true,
          ),
        );
      }

      window.dispatchEvent(new Event(DISCS_CHANGED));
      void reload();
      void remoras.refresh();

      const pausedDiscs = serverDiscs + rest.length;
      if (!pausedRemoras && !pausedDiscs) return "Nothing to pause: every Disc is already paused.";
      if (!pausedRemoras) return `Paused ${plural(pausedDiscs, "Disc")}.`;
      if (!pausedDiscs) return `Paused ${plural(pausedRemoras, "remora")}.`;
      return `Paused ${plural(pausedRemoras, "remora")} and ${plural(pausedDiscs, "Disc")}.`;
    } finally {
      setBusy(false);
    }
  };

  return { busy, remoraCount, discCount, panic };
}
