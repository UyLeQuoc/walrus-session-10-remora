import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWalletPicker } from "@/hooks/use-wallet-picker";
import { cn } from "@/lib/utils";

export function WalletPicker({
  label,
  className,
  signIn = false,
  onSignedIn,
  variant,
  size,
  open,
  onOpenChange,
  hideTrigger = false,
}: {
  label: string;
  className?: string;
  signIn?: boolean;
  onSignedIn?: () => void;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  /** Controlled dialog (the account menu opens it from a menu item). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const shown = open ?? internalOpen;
  const setShown = onOpenChange ?? setInternalOpen;
  const { wallets, googleListed, pick, busy, error, status } = useWalletPicker({
    signIn,
    onSignedIn,
  });

  const choose = async (wallet: (typeof wallets)[number]) => {
    const ok = await pick(wallet);
    if (ok) setShown(false);
  };

  return (
    <>
      {hideTrigger ? null : (
        <Button
          type="button"
          variant={variant}
          size={size}
          className={cn(className)}
          onClick={() => setShown(true)}
        >
          {label}
        </Button>
      )}
      <Dialog open={shown} onOpenChange={setShown}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose a wallet</DialogTitle>
            <DialogDescription>
              {googleListed
                ? "Slush, any other Sui wallet in this browser, or your Google account."
                : "Slush, or any other Sui wallet in this browser."}
            </DialogDescription>
          </DialogHeader>
          {wallets.length === 0 ? (
            // ADR-0103: no wallet was a dead end; it now offers the wallet and the no-wallet path.
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                No Sui wallet in this browser. On a phone, open this page in the Slush app.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <a href="https://slush.app" target="_blank" rel="noreferrer">
                    Get Slush ↗
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/playground" onClick={() => setShown(false)}>
                    Try without a wallet
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {wallets.map((wallet) => (
                <Button
                  key={wallet.name}
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void choose(wallet)}
                >
                  {wallet.icon ? (
                    <img src={wallet.icon} alt="" className="size-5 rounded-sm" />
                  ) : null}
                  {wallet.name}
                </Button>
              ))}
            </div>
          )}
          {googleListed ? (
            <p className="text-sm text-muted-foreground">
              Google gives you a Sui address that only Remora uses. To reach the same memory from
              Claude Code or the Walrus dashboard, connect a wallet instead.
            </p>
          ) : null}
          {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
