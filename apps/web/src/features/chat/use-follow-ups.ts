import { useEffect, useRef, useState } from "react";
import { followUpList } from "@/features/chat/follow-ups";
import { apiFetch } from "@/lib/api";

export function useFollowUps(input: {
  conversationId: string | null;
  busy: boolean;
  enabled: boolean;
}): { suggestions: string[] } {
  const { conversationId, busy, enabled } = input;
  const [state, setState] = useState<{ id: string; suggestions: string[] } | null>(null);
  const wasBusy = useRef(false);
  const seenId = useRef(conversationId);
  if (seenId.current !== conversationId) {
    seenId.current = conversationId;
    wasBusy.current = false;
  }
  const suggestions = state?.id === conversationId ? state.suggestions : [];

  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
      setState(null);
      return;
    }
    if (!wasBusy.current || !enabled || !conversationId) return;
    const id = conversationId;
    let cancelled = false;
    void (async () => {
      const res = await apiFetch("/api/chat/suggestions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: id }),
      });
      if (!res.ok || cancelled) return;
      const body: unknown = await res.json().catch(() => null);
      if (!cancelled) setState({ id, suggestions: followUpList(body) });
    })();
    return () => {
      cancelled = true;
    };
  }, [busy, enabled, conversationId]);

  return { suggestions };
}
