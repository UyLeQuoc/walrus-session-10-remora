import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { Memory } from "@/features/me/memory";
import { apiFetch, errorMessage, forgetSession } from "@/lib/api";

export interface Me {
  mode: "anonymous" | "guest" | "owned";
  signedIn?: boolean;
  personId?: string;
  memoryEnabled?: boolean;
  accountId?: string | null;
  walletAddress?: string | null;
  namespace?: string;
  surveyUrl?: string | null;
}

/**
 * One copy of /api/me for the whole page.
 *
 * The sidebar, the strip under the composer, and /me each used to fetch on
 * mount. A refresh then fired enough of them to trip the per-address ceiling,
 * and the 429 body has no `mode`, which the old code read as logged out.
 */
interface Snapshot {
  me: Me | null;
  memories: Memory[];
  error: string;
}

let snapshot: Snapshot = { me: null, memories: [], error: "" };
const listeners = new Set<() => void>();
let ticket = 0;
let queued = false;

function emit(next: Snapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Snapshot {
  return snapshot;
}

function isMe(value: unknown): value is Me {
  if (!value || typeof value !== "object") return false;
  const mode = (value as { mode?: unknown }).mode;
  return mode === "anonymous" || mode === "guest" || mode === "owned";
}

async function pull(mine: number): Promise<void> {
  try {
    const [meRes, memRes] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/me/memories")]);
    if (mine !== ticket) return;
    if (!meRes.ok) {
      const message = await errorMessage(meRes, "Could not load your memory.");
      if (mine !== ticket) return;
      emit({ ...snapshot, error: message });
      return;
    }
    const body: unknown = await meRes.json().catch(() => null);
    if (mine !== ticket) return;
    if (!isMe(body)) {
      emit({ ...snapshot, error: "Could not load your memory." });
      return;
    }
    let memories = snapshot.memories;
    if (memRes.ok) {
      const listed: unknown = await memRes.json().catch(() => null);
      const rows = (listed as { memories?: unknown } | null)?.memories;
      if (Array.isArray(rows)) memories = rows as Memory[];
    }
    if (mine !== ticket) return;
    emit({ me: body, memories, error: "" });
  } catch {
    if (mine !== ticket) return;
    emit({ ...snapshot, error: "Could not load your memory." });
  }
}

export function loadMe(): void {
  ticket += 1;
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    void pull(ticket);
  });
}

export function useMe() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    loadMe();
  }, []);

  const signOut = useCallback(async () => {
    const res = await apiFetch("/api/auth/signout", { method: "POST" });
    if (!res.ok) {
      emit({ ...snapshot, error: await errorMessage(res, "Could not sign out.") });
      return;
    }
    forgetSession();
    loadMe();
  }, []);

  return { me: snap.me, memories: snap.memories, error: snap.error, load: loadMe, signOut };
}
