import { Link } from "react-router";
import { WalletAvatar } from "@/app/wallet-avatar";
import { WalletPicker } from "@/components/wallet-picker";
import { Web3Address } from "@/components/web3-address";
import { useMe } from "@/features/me/use-me";

export function WalletAccount() {
  const { me, load } = useMe();
  const address = me?.walletAddress;

  if (!me) return null;

  if (address) {
    return (
      <Link
        to="/me"
        className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent"
      >
        <WalletAvatar address={address} />
        <Web3Address value={address} className="text-xs" />
      </Link>
    );
  }

  return <WalletPicker className="w-full" label="Connect wallet" signIn onSignedIn={load} />;
}
