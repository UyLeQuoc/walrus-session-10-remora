import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api";

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

function isSummary(value: unknown): value is ConversationSummary {
  if (!value || typeof value !== "object") return false;
  const row = value as { id?: unknown; title?: unknown; updatedAt?: unknown };
  return (
    typeof row.id === "string" && typeof row.title === "string" && typeof row.updatedAt === "string"
  );
}

let listVersion = 0;
const listListeners = new Set<() => void>();

export function bumpConversations(): void {
  listVersion += 1;
  for (const listener of listListeners) listener();
}

function subscribeList(listener: () => void): () => void {
  listListeners.add(listener);
  return () => listListeners.delete(listener);
}

export function useConversations() {
  const version = useSyncExternalStore(
    subscribeList,
    () => listVersion,
    () => listVersion,
  );
  const [items, setItems] = useState<ConversationSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ticket = version;
      const res = await apiFetch("/api/conversations");
      if (!res.ok || cancelled || ticket !== listVersion) return;
      const body: unknown = await res.json().catch(() => null);
      if (cancelled || ticket !== listVersion) return;
      const rows = (body as { conversations?: unknown } | null)?.conversations;
      if (!Array.isArray(rows)) return;
      setItems(rows.filter(isSummary));
    })();
    return () => {
      cancelled = true;
    };
  }, [version]);

  const remove = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) return false;
    setItems((prev) => prev.filter((item) => item.id !== id));
    return true;
  }, []);

  return { items, remove };
}
