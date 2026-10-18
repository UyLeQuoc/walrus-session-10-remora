import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSignPersonalMessage,
  useSignTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { useCallback, useEffect, useState } from "react";
import {
  addDelegateKeyTx,
  type ChainConfig,
  createAccountTx,
  findAccountId,
  removeDelegateKeyTx,
} from "@/features/connect/memwal";
import { sponsorAndExecute } from "@/features/connect/sponsor";
import { useCoreExecutor } from "@/hooks/use-core-executor";
import { apiFetch } from "@/lib/api";

export interface TokenInfo {
  kind: "connect" | "disconnect";
  publicKey: string;
  label: string;
  accountId: string | null;
}

export type ConnectStep = "loading" | "ready" | "working" | "done" | "error";

export function useConnectFlow(kind: "connect" | "disconnect", token: string | undefined) {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const execute = useCoreExecutor();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction({ execute });

  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [chain, setChain] = useState<ChainConfig | null>(null);
  const [step, setStep] = useState<ConnectStep>("loading");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [selfPaid, setSelfPaid] = useState(false);
  const [linkDead, setLinkDead] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [tokenRes, cfgRes] = await Promise.all([
          apiFetch(`/api/connect/${token}`),
          apiFetch("/api/config"),
        ]);
        if (!tokenRes.ok) {
          setLinkDead(true);
          throw new Error(
            tokenRes.status === 404
              ? `This link has expired or was already used. Run /${kind} again in the chat for a new one.`
              : (((await tokenRes.json().catch(() => ({}))) as { error?: string }).error ??
                  "Link not valid."),
          );
        }
        if (cancelled) return;
        setInfo((await tokenRes.json()) as TokenInfo);
        setChain((await cfgRes.json()) as ChainConfig);
        setStep("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load this link.");
        setStep("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, kind]);

  const run = useCallback(async () => {
    if (!info || !chain || !account) return;
    setStep("working");
    setError("");
    setSelfPaid(false);
    const deps = {
      relayerUrl: chain.relayerUrl,
      sender: account.address,
      suiClient,
      signTransaction,
      signPersonalMessage,
      signAndExecuteTransaction,
      onFallback: () => {
        setSelfPaid(true);
        setStatus(
          "Gas sponsorship is unavailable, so your wallet will pay for this transaction. Approve it to continue.",
        );
      },
    };
    try {
      let accountId = await findAccountId(suiClient, chain.registryId, account.address);
      if (kind === "connect") {
        if (!accountId) {
          setStatus("Creating your Walrus Memory account…");
          await sponsorAndExecute(() => createAccountTx(chain), deps);
          for (let i = 0; i < 10 && !accountId; i++) {
            await new Promise((r) => setTimeout(r, 1500));
            accountId = await findAccountId(suiClient, chain.registryId, account.address);
          }
          if (!accountId) {
            throw new Error(
              "The account was created but has not appeared on chain yet. Reload and try again.",
            );
          }
        }
        setStatus("Granting hippo access to your account…");
        const id = accountId;
        const { digest } = await sponsorAndExecute(
          () => addDelegateKeyTx(chain, id, info.publicKey, info.label),
          deps,
        );
        setStatus("Confirming on chain…");
        await finish(accountId, digest);
      } else {
        if (!accountId) throw new Error("This wallet does not own a Walrus Memory account.");
        setStatus("Revoking hippo's access…");
        const id = accountId;
        const { digest } = await sponsorAndExecute(
          () => removeDelegateKeyTx(chain, id, info.publicKey),
          deps,
        );
        setStatus("Confirming on chain…");
        await finish(accountId, digest);
      }
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStep("error");
    }

    async function finish(accountId: string, digest: string) {
      for (let i = 0; i < 6; i++) {
        const res = await apiFetch(`/api/connect/${token}/done`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accountId, walletAddress: account?.address, digest }),
        });
        if (res.ok) return;
        if (res.status !== 409) {
          throw new Error(
            ((await res.json()) as { error?: string }).error ?? "Confirmation failed.",
          );
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      throw new Error("The transaction landed but confirmation kept failing. Try the link again.");
    }
  }, [
    account,
    chain,
    info,
    kind,
    signAndExecuteTransaction,
    signPersonalMessage,
    signTransaction,
    suiClient,
    token,
  ]);

  return { account, info, step, status, error, selfPaid, linkDead, run };
}
