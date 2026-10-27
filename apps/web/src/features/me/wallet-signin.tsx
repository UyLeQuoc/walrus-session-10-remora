import { WalletPicker } from "@/components/wallet-picker";

export function WalletSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  return (
    <div className="ob-card sm:flex-row sm:items-center">
      <div className="flex flex-1 flex-col gap-1">
        <h2 className="text-sm font-semibold text-ob-text">Already own your memory?</h2>
        <p className="text-md text-ob-muted">
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
