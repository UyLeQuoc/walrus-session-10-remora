/** N10: one tap pauses every Disc you own on this network, in one transaction. */
import { useCurrentAccount } from "@mysten/dapp-kit";
import { buildPause, toDiscError } from "@remora/disc-sdk";
import { OctagonX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNetwork } from "@/lib/network";
import { DISCS_CHANGED, useOwnerDiscs } from "./discs";
import { useSignAndRun } from "./sign";

export function PanicButton() {
  const network = useNetwork();
  const account = useCurrentAccount();
  const { discs, cfg } = useOwnerDiscs(account?.address ?? null, network);
  const run = useSignAndRun();
  const [busy, setBusy] = useState(false);
  const live = (discs ?? []).filter((d) => !d.disc.paused);
  if (!account || !cfg) return null;

  const panic = async () => {
    if (!live.length) {
      toast("Nothing to pause: every Disc is already paused.");
      return;
    }
    setBusy(true);
    try {
      const digest = await run(
        buildPause(
          cfg,
          live.map((d) => d.disc.id),
          true,
        ),
      );
      toast.success(`Paused ${live.length} Disc${live.length > 1 ? "s" : ""}.`, {
        description: digest,
      });
      window.dispatchEvent(new Event(DISCS_CHANGED));
    } catch (err) {
      toast.error(toDiscError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="destructive"
      onClick={() => void panic()}
      disabled={busy}
      aria-label="Pause all spending"
      title="Pause every Disc on this network"
    >
      <OctagonX />
      <span className="hidden sm:inline">Pause all</span>
    </Button>
  );
}
