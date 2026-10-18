import { useCallback, useEffect, useRef, useState } from "react";
import {
  keepPolling,
  parseWriteStatus,
  type RememberedCard,
  STATUS_POLL_LIMIT_MS,
} from "@/features/chat/remembered";
import { cardsFromStored, mergeLoadedCards } from "@/features/chat/stored-memories";
import { loadMe } from "@/features/me/use-me";
import { apiFetch } from "@/lib/api";

const POLL_MS = 3_000;

export function useChatMemories(
  conversationId: string | null,
  busy: boolean,
): {
  cards: RememberedCard[];
  loading: boolean;
  error: string;
  conceal: (key: string) => void;
} {
  const [reload, setReload] = useState(0);
  const settled = useRef(new Set<string>());
  const wasBusy = useRef(busy);

  useEffect(() => {
    if (wasBusy.current && !busy) {
      setReload((current) => current + 1);
      loadMe();
    }
    wasBusy.current = busy;
  }, [busy]);
  const [state, setState] = useState<{
    id: string;
    cards: RememberedCard[];
    loading: boolean;
    error: string;
  } | null>(null);

  const seenChat = useRef<string | null>(null);

  useEffect(() => {
    if (!conversationId || reload < 0) return;
    if (seenChat.current !== conversationId) {
      seenChat.current = conversationId;
      settled.current = new Set();
    }
    const id = conversationId;
    let cancelled = false;
    setState((current) =>
      current?.id === id
        ? { ...current, loading: current.cards.length === 0, error: "" }
        : { id, cards: [], loading: true, error: "" },
    );
    void (async () => {
      try {
        const res = await apiFetch(`/api/conversations/${id}/memories`);
        if (cancelled) return;
        if (res.status === 404) {
          setState((current) => ({
            id,
            cards: current?.id === id ? current.cards : [],
            loading: false,
            error: "",
          }));
          return;
        }
        if (!res.ok) {
          setState({
            id,
            cards: [],
            loading: false,
            error: "Could not load what this chat remembered.",
          });
          return;
        }
        const body: unknown = await res.json().catch(() => null);
        if (cancelled) return;
        const limited =
          body && typeof body === "object" && (body as { limited?: unknown }).limited === true;
        const message =
          body &&
          typeof body === "object" &&
          typeof (body as { message?: unknown }).message === "string"
            ? (body as { message: string }).message
            : "";
        setState((current) => {
          return {
            id,
            cards: mergeLoadedCards(
              current?.id === id ? current.cards : [],
              cardsFromStored(body, Date.now()),
            ),
            loading: false,
            error: limited ? message || "Could not read every fact back from Walrus just now." : "",
          };
        });
      } catch {
        if (cancelled) return;
        setState({
          id,
          cards: [],
          loading: false,
          error: "Could not load what this chat remembered.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, reload]);

  const pendingKey = (state?.id === conversationId ? state.cards : [])
    .flatMap((card) => {
      if (!card.indexId) return [];
      if (
        !keepPolling({
          status: card.status,
          saved: card.saved,
          startedAt: card.startedAt,
          now: Date.now(),
          hidden: card.hidden,
        })
      ) {
        return [];
      }
      return [`${card.indexId}:${card.startedAt}`];
    })
    .join(",");

  useEffect(() => {
    if (!conversationId || !pendingKey) return;
    const id = conversationId;
    const watched = pendingKey.split(",");
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = async () => {
      await Promise.all(
        watched.map(async (part) => {
          const split = part.lastIndexOf(":");
          const indexId = part.slice(0, split);
          const startedAt = Number(part.slice(split + 1));
          if (!indexId || Number.isNaN(startedAt)) return;
          if (Date.now() - startedAt >= STATUS_POLL_LIMIT_MS) return;
          try {
            const res = await apiFetch(`/api/me/memories/${indexId}/status`);
            if (!res.ok || cancelled) return;
            const parsed = parseWriteStatus(await res.json().catch(() => null));
            if (!parsed || cancelled) return;
            if (parsed.status === "stored" && !settled.current.has(indexId)) {
              settled.current.add(indexId);
              setReload((current) => current + 1);
              loadMe();
            }
            setState((current) => {
              if (!current || current.id !== id) return current;
              return {
                ...current,
                cards: current.cards.map((card) =>
                  card.indexId === indexId
                    ? {
                        ...card,
                        status: parsed.status,
                        ...(parsed.blobId ? { blobId: parsed.blobId } : {}),
                        ...(parsed.hidden ? { hidden: true } : {}),
                      }
                    : card,
                ),
              };
            });
          } catch {
            if (cancelled) return;
            setState((current) => {
              if (!current || current.id !== id) return current;
              return {
                ...current,
                cards: current.cards.map((card) =>
                  card.indexId === indexId
                    ? {
                        ...card,
                        error:
                          "Could not check whether that memory landed. It may still be writing.",
                      }
                    : card,
                ),
              };
            });
          }
        }),
      );
    };
    void tick();
    timer = setInterval(() => {
      void tick();
    }, POLL_MS);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [conversationId, pendingKey]);

  const conceal = useCallback(
    (key: string) => {
      setState((current) => {
        if (!current || current.id !== conversationId) return current;
        return {
          ...current,
          cards: current.cards.map((card) => (card.key === key ? { ...card, hidden: true } : card)),
        };
      });
    },
    [conversationId],
  );

  if (!conversationId) return { cards: [], loading: false, error: "", conceal };
  if (!state || state.id !== conversationId) {
    return { cards: [], loading: true, error: "", conceal };
  }
  return { cards: state.cards, loading: state.loading, error: state.error, conceal };
}
