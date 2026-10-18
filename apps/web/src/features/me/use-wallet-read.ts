import { useCurrentAccount, useSignPersonalMessage, useSuiClient } from "@mysten/dapp-kit";
import type { SessionKey } from "@mysten/seal";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { useCallback, useState } from "react";
import type { Memory } from "@/features/me/memory";
import { useMe } from "@/features/me/use-me";
import {
  type ReadResult,
  readableRows,
  readMarkdown,
  sha256Text,
  walletReadRefusal,
} from "@/features/me/wallet-read";
import { apiFetch } from "@/lib/api";
import { decryptSealed, sealApiKey, sealClient, sealedPackage, walletSession } from "@/lib/seal";
import { walrusRead } from "@/lib/walrus";

function sentence(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  if (/rejected|denied|cancel/i.test(message)) return "The wallet request was declined.";
  return message || "Could not read that memory just now.";
}

export function useWalletRead(memories: Memory[]) {
  const { me } = useMe();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [results, setResults] = useState<ReadResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const apiKey = sealApiKey(import.meta.env);
  const rows = readableRows(memories, me?.accountId);
  const refusal = !apiKey
    ? "Reading with your wallet is not set up on this server."
    : walletReadRefusal({
        owned: me?.mode === "owned",
        ownerWallet: me?.walletAddress ?? null,
        connected: account?.address ?? null,
      });

  const read = useCallback(async () => {
    if (refusal || !apiKey || !me?.accountId || !me.walletAddress) return;
    if (!("core" in client)) {
      setError("Sui client is missing the core API.");
      return;
    }
    const sui = client as unknown as ClientWithCoreApi;
    const owner = me.walletAddress;
    const accountId = me.accountId;
    setBusy(true);
    setError("");
    setResults([]);
    try {
      const res = await apiFetch("/api/config");
      const cfg = (await res.json()) as { packageId?: unknown; registryId?: unknown };
      if (typeof cfg.packageId !== "string" || typeof cfg.registryId !== "string") {
        throw new Error("hippo's settings are missing the Walrus Memory package.");
      }
      const approval = {
        packageId: cfg.packageId,
        registryId: cfg.registryId,
        accountId,
        sender: owner,
      };
      const seal = sealClient(sui, apiKey);
      let session: SessionKey | null = null;
      const out: ReadResult[] = [];
      for (const row of rows) {
        const base = { blobId: row.blobId ?? "", type: row.type, createdAt: row.createdAt };
        try {
          const ciphertext = await walrusRead(base.blobId);
          session ??= await walletSession({
            sui,
            address: owner,
            packageId: sealedPackage(ciphertext),
            signPersonalMessage: async (message) =>
              (await signPersonalMessage({ message })).signature,
          });
          const plain = await decryptSealed({ seal, sui, approval, session, ciphertext });
          const text = new TextDecoder().decode(plain);
          out.push({ ...base, text, verified: (await sha256Text(text)) === row.textSha256 });
        } catch (err) {
          if (!session) throw err;
          out.push({ ...base, error: sentence(err) });
        }
        setResults([...out]);
      }
    } catch (err) {
      setError(sentence(err));
    } finally {
      setBusy(false);
    }
  }, [apiKey, client, me?.accountId, me?.walletAddress, refusal, rows, signPersonalMessage]);

  const download = useCallback(() => {
    if (!me?.accountId || results.length === 0) return;
    const blob = new Blob([readMarkdown(results, me.accountId, new Date().toISOString())], {
      type: "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hippo-memory-read-with-my-wallet.md";
    link.click();
    URL.revokeObjectURL(url);
  }, [me?.accountId, results]);

  return { readable: rows.length, results, busy, error, refusal, read, download };
}
