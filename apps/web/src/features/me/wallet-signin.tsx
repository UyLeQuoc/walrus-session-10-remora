import { WalletPicker } from "@/components/wallet-picker";

export function WalletSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
      <div className="flex flex-1 flex-col gap-1">
        <h2 className="font-medium">Already own your memory?</h2>
        <p className="text-sm text-muted-foreground">
          Sign in with the wallet you used on another channel.
        </p>
      </div>
      <WalletPicker
        label="Connect your Sui wallet"
        className="self-start sm:self-auto"
        signIn
        onSignedIn={onSignedIn}
      />
    </div>
  );
}
