import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSignPersonalMessage,
  useSuiClient,
} from "@mysten/dapp-kit";
import type { SealClient } from "@mysten/seal";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { useCallback, useEffect, useState } from "react";
import {
  type FileChain,
  sealEncrypt,
  WAL_COIN_TYPE,
  walrusClient,
  walrusWrite,
} from "@/features/documents/clients";
import {
  fileKind,
  fileRefusal,
  fundsRefusal,
  ownerRefusal,
  STORAGE_EPOCHS,
} from "@/features/documents/file-rules";
import { openFile, type RecordBody, storeFile } from "@/features/documents/file-store";
import { accessCounter, documentSealId } from "@/features/documents/seal-id";
import { WalletSigner } from "@/features/documents/wallet-signer";
import { useMe } from "@/features/me/use-me";
import { useCoreExecutor } from "@/hooks/use-core-executor";
import { apiFetch } from "@/lib/api";
import { decryptSealed, sealApiKey, sealClient, walletSession } from "@/lib/seal";
import { walrusRead } from "@/lib/walrus";

export interface StoredFile {
  id: string;
  name: string;
  blobId: string;
  sealId: string;
  accountId: string;
  byteSize: number;
  createdAt: string;
}

export interface AttachedFile {
  id: string;
  name: string;
  text: string;
}

type Phase = "idle" | "sealing" | "paying" | "saving" | "opening";

const STATUS: Record<Phase, string> = {
  idle: "",
  sealing: "Encrypting the file in this browser.",
  paying:
    "Approve two transactions in your wallet: one registers the file on Walrus, one certifies it.",
  saving: "Stored on Walrus. Telling hippo where it is.",
  opening: "Approve the signature in your wallet to open the file here. It spends nothing.",
};

function isStoredFile(value: unknown): value is StoredFile {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.name === "string" &&
    typeof row.blobId === "string" &&
    typeof row.sealId === "string"
  );
}

async function errorText(res: Response, fallback: string): Promise<string> {
  const body: unknown = await res.json().catch(() => null);
  const error = body && typeof body === "object" ? (body as { error?: unknown }).error : null;
  return typeof error === "string" ? error : fallback;
}

function sentence(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  if (/rejected|denied|cancel/i.test(message))
    return "The wallet request was declined. Nothing changed.";
  return message || "Something went wrong with that file. Try again.";
}

export function useDocuments() {
  const { me } = useMe();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const execute = useCoreExecutor();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction({ execute });
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [attached, setAttached] = useState<AttachedFile | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const apiKey = sealApiKey(import.meta.env);

  const refusal = !apiKey
    ? "Private files are not set up on this server."
    : ownerRefusal({
        owned: me?.mode === "owned",
        ownerWallet: me?.walletAddress ?? null,
        connected: account?.address ?? null,
      });

  const loadFiles = useCallback(async () => {
    const res = await apiFetch("/api/documents").catch(() => null);
    if (!res?.ok) return;
    const body: unknown = await res.json().catch(() => null);
    const rows =
      body && typeof body === "object" ? (body as { documents?: unknown }).documents : [];
    setFiles(Array.isArray(rows) ? rows.filter(isStoredFile) : []);
  }, []);

  useEffect(() => {
    if (me?.mode === "owned") void loadFiles();
  }, [me?.mode, loadFiles]);

  const chain = useCallback(async (): Promise<{ sui: ClientWithCoreApi; chain: FileChain }> => {
    if (!("core" in client)) throw new Error("Sui client is missing the core API.");
    const sui = client as unknown as ClientWithCoreApi;
    const res = await apiFetch("/api/config");
    if (!res.ok) throw new Error("Could not reach hippo's settings. Try again.");
    const cfg = (await res.json()) as { packageId?: unknown; registryId?: unknown };
    if (typeof cfg.packageId !== "string" || typeof cfg.registryId !== "string") {
      throw new Error("hippo's settings are missing the Walrus Memory package.");
    }
    if (!me?.accountId || !me.walletAddress) throw new Error("Run /connect first.");
    return {
      sui,
      chain: {
        packageId: cfg.packageId,
        registryId: cfg.registryId,
        accountId: me.accountId,
        owner: me.walletAddress,
      },
    };
  }, [client, me?.accountId, me?.walletAddress]);

  const upload = useCallback(
    async (file: File) => {
      setError("");
      const blocked = refusal ?? fileRefusal(file);
      const kind = fileKind(file.name);
      if (blocked || !kind || !apiKey || !account) {
        setError(blocked ?? "Pick a .txt or .md file.");
        return;
      }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const text = new TextDecoder().decode(bytes);
        const { sui, chain: config } = await chain();
        const object = await sui.core.getObject({
          objectId: config.accountId,
          include: { json: true },
        });
        const counter = accessCounter((object.object as { json?: unknown }).json);
        if (counter === null) throw new Error("Could not read your Walrus Memory account on Sui.");
        const seal: SealClient = sealClient(sui, apiKey);
        const signer = new WalletSigner(account.address, (transaction) =>
          signAndExecute({ transaction }),
        );
        const stored = await storeFile(
          {
            encrypt: (sealId, plaintext) => sealEncrypt(seal, config.packageId, sealId, plaintext),
            writeBlob: async (ciphertext) => {
              const walrus = await walrusClient(sui);
              const [cost, sui0, wal] = await Promise.all([
                walrus.storageCost(ciphertext.byteLength, STORAGE_EPOCHS),
                sui.core.getBalance({ owner: account.address, coinType: "0x2::sui::SUI" }),
                sui.core.getBalance({ owner: account.address, coinType: WAL_COIN_TYPE }),
              ]);
              const short = fundsRefusal({
                sui: BigInt(sui0.balance.balance),
                wal: BigInt(wal.balance.balance),
                walNeeded: cost.totalCost,
              });
              if (short) throw new Error(short);
              return walrusWrite(walrus, signer, ciphertext);
            },
            record: async (body: RecordBody) => {
              const res = await apiFetch("/api/documents", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              });
              if (!res.ok) throw new Error(await errorText(res, "hippo could not keep that file."));
              const saved = (await res.json()) as { id?: unknown };
              if (typeof saved.id !== "string") throw new Error("hippo could not keep that file.");
              return { id: saved.id };
            },
            onStage: setPhase,
          },
          {
            name: file.name,
            kind,
            bytes,
            sealId: documentSealId(config.owner, counter),
          },
        );
        setAttached({ id: stored.id, name: file.name, text });
        await loadFiles();
      } catch (err) {
        setError(sentence(err));
      } finally {
        setPhase("idle");
      }
    },
    [account, apiKey, chain, loadFiles, refusal, signAndExecute],
  );

  const open = useCallback(
    async (file: StoredFile) => {
      setError("");
      if (refusal || !apiKey) {
        setError(refusal ?? "Private files are not set up on this server.");
        return;
      }
      setPhase("opening");
      try {
        const { sui, chain: config } = await chain();
        const seal = sealClient(sui, apiKey);
        const text = await openFile(
          {
            fetchBlob: walrusRead,
            decrypt: async (ciphertext) =>
              decryptSealed({
                seal,
                sui,
                approval: {
                  packageId: config.packageId,
                  registryId: config.registryId,
                  accountId: config.accountId,
                  sender: config.owner,
                },
                session: await walletSession({
                  sui,
                  address: config.owner,
                  packageId: config.packageId,
                  signPersonalMessage: async (message) =>
                    (await signPersonalMessage({ message })).signature,
                }),
                ciphertext,
              }),
          },
          file.blobId,
        );
        setAttached({ id: file.id, name: file.name, text });
      } catch (err) {
        setError(sentence(err));
      } finally {
        setPhase("idle");
      }
    },
    [apiKey, chain, refusal, signPersonalMessage],
  );

  const detach = useCallback(() => setAttached(null), []);

  return {
    files,
    attached,
    busy: phase !== "idle",
    status: STATUS[phase],
    error,
    refusal,
    upload,
    open,
    detach,
  };
}
