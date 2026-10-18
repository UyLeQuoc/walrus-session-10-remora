import { useCallback, useEffect, useRef, useState } from "react";
import {
  cardsFromMessages,
  keepPolling,
  mergeCards,
  parseWriteStatus,
  type RememberedCard,
  STATUS_POLL_LIMIT_MS,
  STATUS_POLL_MS,
} from "@/features/chat/remembered";
import { apiFetch } from "@/lib/api";
import { setMemoryHidden } from "@/lib/memory-visibility";

export function useRemembered(
  messages: Array<{ id: string; parts?: Array<Record<string, unknown>> }>,
) {
  const started = useRef(new Map<string, number>());
  const [extra, setExtra] = useState<RememberedCard[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [overrides, setOverrides] = useState<
    Record<
      string,
      { status?: RememberedCard["status"]; blobId?: string; hidden?: boolean; error?: string }
    >
  >({});

  const stamp = (key: string): number => {
    const existing = started.current.get(key);
    if (existing !== undefined) return existing;
    const now = Date.now();
    started.current.set(key, now);
    return now;
  };

  const seeds = cardsFromMessages(messages, Date.now(), stamp);
  const cards = mergeCards(extra, seeds).map((card) => {
    const override = overrides[card.key];
    if (!override) return card;
    return {
      ...card,
      ...(override.status ? { status: override.status } : {}),
      ...(override.blobId ? { blobId: override.blobId } : {}),
      ...(override.hidden ? { hidden: true } : {}),
      ...(override.error ? { error: override.error } : {}),
    };
  });

  const polling = cards.flatMap((card) => {
    if (!card.indexId) return [];
    if (
      !keepPolling({
        status: card.status,
        saved: card.saved,
        startedAt: card.startedAt,
        now,
        hidden: card.hidden,
      })
    ) {
      return [];
    }
    return [{ id: card.indexId, startedAt: card.startedAt }];
  });
  const pollKey = polling.map((item) => `${item.id}:${item.startedAt}`).join(",");

  useEffect(() => {
    if (!pollKey) return;
    const watched = pollKey.split(",").flatMap((part) => {
      const split = part.lastIndexOf(":");
      if (split <= 0) return [];
      const id = part.slice(0, split);
      const startedAt = Number(part.slice(split + 1));
      if (!id || Number.isNaN(startedAt)) return [];
      return [{ id, startedAt }];
    });
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = async () => {
      const due = watched.filter((item) => Date.now() - item.startedAt < STATUS_POLL_LIMIT_MS);
      if (due.length === 0) {
        if (timer) clearInterval(timer);
        setNow(Date.now());
        return;
      }
      await Promise.all(
        due.map(async (item) => {
          try {
            const res = await apiFetch(`/api/me/memories/${item.id}/status`);
            if (!res.ok || cancelled) return;
            const parsed = parseWriteStatus(await res.json().catch(() => null));
            if (!parsed || cancelled) return;
            setOverrides((current) => ({
              ...current,
              [item.id]: {
                ...current[item.id],
                status: parsed.status,
                ...(parsed.blobId ? { blobId: parsed.blobId } : {}),
                ...(parsed.hidden ? { hidden: true } : {}),
              },
            }));
          } catch {
            if (cancelled) return;
            setOverrides((current) => ({
              ...current,
              [item.id]: {
                ...current[item.id],
                error: "Could not check whether that memory landed. It may still be writing.",
              },
            }));
          }
        }),
      );
    };
    void tick();
    timer = setInterval(() => {
      void tick();
    }, STATUS_POLL_MS);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [pollKey]);

  const add = useCallback((card: RememberedCard) => {
    started.current.set(card.key, card.startedAt);
    setExtra((current) => mergeCards(current, [card]));
  }, []);

  const hide = useCallback(async (card: RememberedCard) => {
    if (!card.blobId) return { ok: false as const, message: "That memory is still writing." };
    try {
      const result = await setMemoryHidden(card.blobId, true);
      if (!result.ok) return result;
      setOverrides((current) => ({
        ...current,
        [card.key]: { ...current[card.key], hidden: true },
      }));
      return { ok: true as const };
    } catch {
      return { ok: false as const, message: "Could not hide that. Try again." };
    }
  }, []);

  return { cards, add, hide, now };
}
