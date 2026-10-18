import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { appPath } from "@/features/me/app-path";
import { apiFetch } from "@/lib/api";

export interface Delegate {
  label: string;
  publicKeyHex: string;
  suiAddress: string;
  isHippo: boolean;
}

export interface Account {
  accountId: string;
  explorerUrl: string;
  owner?: string;
  ownerUrl?: string | null;
  active?: boolean;
  yours?: boolean;
  unreadable?: boolean;
  delegates?: Delegate[];
}

export function useAccount(onError: (message: string) => void) {
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiFetch("/api/me/account")
      .then((r) => r.json() as Promise<{ account: Account | null }>)
      .then((d) => {
        if (!cancelled) setAccount(d.account ?? null);
      })
      .catch(() => {
        if (!cancelled) setAccount(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const start = useCallback(
    async (kind: "connect" | "disconnect") => {
      setBusy(true);
      try {
        const res = await apiFetch(`/api/me/${kind}`, { method: "POST" });
        const body = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !body.url) throw new Error(body.error ?? "Could not start that.");
        const path = appPath(body.url, window.location.origin);
        if (path) {
          navigate(path);
          return;
        }
        window.location.assign(body.url);
      } catch (err) {
        setBusy(false);
        onError(err instanceof Error ? err.message : "Could not start that.");
      }
    },
    [navigate, onError],
  );

  return { account, busy, start };
}
