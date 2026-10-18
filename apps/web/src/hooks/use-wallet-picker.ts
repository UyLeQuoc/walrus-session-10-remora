import {
  useConnectWallet,
  useCurrentAccount,
  useCurrentWallet,
  useWallets,
} from "@mysten/dapp-kit";
import { isGoogleWallet } from "@mysten/enoki";
import { useCallback, useState } from "react";
import { finishSignIn, requestSignInChallenge } from "@/hooks/wallet-sign-in";

type ListedWallet = ReturnType<typeof useWallets>[number];
type ConnectedAccount = NonNullable<ReturnType<typeof useCurrentAccount>>;

export function useWalletPicker(options: { signIn: boolean; onSignedIn?: () => void }) {
  const wallets = useWallets();
  const account = useCurrentAccount();
  const { currentWallet } = useCurrentWallet();
  const { mutateAsync: connectWallet } = useConnectWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const signInWith = useCallback(
    async (wallet: ListedWallet, signer: ConnectedAccount) => {
      const feature = wallet.features["sui:signPersonalMessage"];
      if (!feature) throw new Error("This wallet cannot sign a message.");
      setStatus("Approve the sign-in in your wallet. It spends nothing.");
      const { nonce, message } = await requestSignInChallenge();
      const { signature } = await feature.signPersonalMessage({
        message: new TextEncoder().encode(message),
        account: signer,
        chain: "sui:mainnet",
      });
      const done = await finishSignIn(nonce, signature);
      if (!done.ok) throw new Error(done.error);
      options.onSignedIn?.();
    },
    [options.onSignedIn],
  );

  const pick = useCallback(
    async (wallet: ListedWallet) => {
      setBusy(true);
      setError("");
      setStatus("");
      try {
        const same = Boolean(account && currentWallet && currentWallet.name === wallet.name);
        const signer = same ? account : null;
        if (!signer) {
          setStatus("Approve the connection in your wallet.");
          const connected = await connectWallet({ wallet });
          const next = connected.accounts[0];
          if (!next) throw new Error("That wallet connected without an account.");
          if (options.signIn) await signInWith(wallet, next);
        } else if (options.signIn) {
          await signInWith(wallet, signer);
        }
        setStatus("");
        return true;
      } catch (err) {
        setStatus("");
        setError(err instanceof Error ? err.message : "Could not connect that wallet.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [account, connectWallet, currentWallet, options.signIn, signInWith],
  );

  const googleListed = wallets.some(
    (wallet) => typeof wallet.features === "object" && isGoogleWallet(wallet),
  );

  return { wallets, googleListed, pick, busy, error, status };
}
