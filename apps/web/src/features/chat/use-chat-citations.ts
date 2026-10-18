import { useEffect, useRef, useState } from "react";
import {
  applyResolved,
  citationKey,
  resolvedFrom,
  type UiMessage,
} from "@/features/chat/transcript";
import { apiFetch, errorMessage } from "@/lib/api";

export interface CitationNote {
  note: string;
  retry: (() => void) | null;
}

const READING = "Reading the memories this chat used.";
const FAILED = "Could not read what this chat used. Try again.";

export function useChatCitations(
  conversationId: string | null,
  messages: UiMessage[],
  apply: (messages: UiMessage[]) => void,
): CitationNote {
  const [pulse, setPulse] = useState(0);
  const [note, setNote] = useState<{ id: string; text: string; failed: boolean } | null>(null);
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const conversationRef = useRef(conversationId);
  conversationRef.current = conversationId;
  const forceRef = useRef(false);
  const key = citationKey(conversationId, messages);

  useEffect(() => {
    const forced = forceRef.current;
    forceRef.current = false;
    if (!conversationId || pulse < 0 || (!key && !forced)) return;
    const id = conversationId;
    let cancelled = false;
    setNote({ id, text: READING, failed: false });
    void (async () => {
      try {
        const res = await apiFetch(`/api/conversations/${id}/citations`, { method: "POST" });
        if (cancelled || conversationRef.current !== id) return;
        if (!res.ok) {
          setNote({ id, text: await errorMessage(res, FAILED), failed: true });
          return;
        }
        const parsed = resolvedFrom(await res.json().catch(() => null));
        if (cancelled || conversationRef.current !== id) return;
        if (!parsed) {
          setNote({ id, text: FAILED, failed: true });
          return;
        }
        if (parsed.status !== "unavailable") {
          applyRef.current(applyResolved(messagesRef.current, parsed.messages));
        }
        setNote(
          parsed.status === "complete"
            ? null
            : { id, text: parsed.message || FAILED, failed: true },
        );
      } catch {
        if (cancelled || conversationRef.current !== id) return;
        setNote({ id, text: FAILED, failed: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, key, pulse]);

  const retry =
    note?.id === conversationId && note.failed
      ? () => {
          forceRef.current = true;
          setPulse((tick) => tick + 1);
        }
      : null;
  return {
    note: note?.id === conversationId ? note.text : "",
    retry,
  };
}
