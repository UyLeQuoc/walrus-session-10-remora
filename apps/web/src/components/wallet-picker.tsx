import { useState } from "react";
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
}: {
  label: string;
  className?: string;
  signIn?: boolean;
  onSignedIn?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { wallets, googleListed, pick, busy, error, status } = useWalletPicker({
    signIn,
    onSignedIn,
  });

  const choose = async (wallet: (typeof wallets)[number]) => {
    const ok = await pick(wallet);
    if (ok) setOpen(false);
  };

  return (
    <>
      <Button type="button" className={cn(className)} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
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
            <p className="text-sm text-muted-foreground">
              No wallet found. Install Slush or another Sui wallet, then reload this page.
            </p>
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
              Google gives you a Sui address that only hippo uses. To reach the same memory from
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
