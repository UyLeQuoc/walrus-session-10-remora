/**
 * N10 / E1: the header's emergency stop. A soft destructive pill (icon + "Pause all", icon only on a
 * phone) so it is easy to find, still quiet next to the network menu. It opens a confirm; nothing
 * signs on one tap.
 */
import { useCurrentAccount } from "@mysten/dapp-kit";
import { OctagonPause } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/app/confirm-action";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { WalletPicker } from "@/components/wallet-picker";
import { useMe } from "@/features/me/use-me";
import { usePanic } from "./use-panic";

export function PanicButton() {
  const { me, load } = useMe();
  const account = useCurrentAccount();
  const { busy, remoraCount, discCount, panic } = usePanic();
  const [connectOpen, setConnectOpen] = useState(false);

  if (!me?.signedIn) return null;

  const trigger = (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      aria-label="Pause all spending"
      disabled={busy}
      className="h-7 gap-1.5 rounded-full px-2.5 text-ob-danger-text sm:px-3"
    >
      <OctagonPause />
      <span className="hidden sm:inline">Pause all</span>
    </Button>
  );

  if (!account) {
    return (
      <AlertDialog open={connectOpen} onOpenChange={setConnectOpen}>
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Connect a wallet to pause everything</AlertDialogTitle>
            <AlertDialogDescription>
              Pausing signs one transaction, so the wallet behind your session has to be connected
              again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <WalletPicker label="Connect wallet" signIn onSignedIn={load} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const what =
    remoraCount || discCount
      ? `${remoraCount} remora${remoraCount === 1 ? "" : "s"} and ${discCount} Disc${
          discCount === 1 ? "" : "s"
        } stop paying until you resume each one.`
      : "Every remora and every Disc on this network stops paying until you resume them one by one.";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <ConfirmAction
              trigger={trigger}
              title="Pause all spending on testnet?"
              description={what}
              confirmLabel={remoraCount || discCount ? "Pause everything" : "Pause all"}
              onConfirm={async () => {
                const message = await panic();
                toast.success(message);
              }}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>Pause all spending</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
