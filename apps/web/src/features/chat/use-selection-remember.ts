import { useCallback, useState } from "react";
import { postRemember, rememberDraft } from "@/features/chat/remember-request";
import type { RememberType } from "@/features/chat/remember-types";
import type { RememberedCard } from "@/features/chat/remembered";

export interface RememberDraft {
  text: string;
  type: RememberType;
  replaces?: string;
}

export function useSelectionRemember(onSaved: (card: RememberedCard) => void) {
  const [draft, setDraft] = useState<RememberDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = useCallback((next: RememberDraft) => {
    setError("");
    setDraft(next);
  }, []);

  const cancel = useCallback(() => {
    if (busy) return;
    setDraft(null);
    setError("");
  }, [busy]);

  const submit = useCallback(
    async (text: string) => {
      if (!draft) return;
      const body = rememberDraft(text, draft.type, draft.replaces);
      if (!body) {
        setError("Write the fact in a few words, then try again.");
        return;
      }
      setBusy(true);
      setError("");
      const result = await postRemember(body);
      setBusy(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const key = result.indexId ?? result.blobId ?? body.text;
      onSaved({
        key,
        type: body.type,
        text: body.text,
        saved: result.saved,
        status: result.saved ? "pending" : "stored",
        startedAt: Date.now(),
        hidden: false,
        ...(result.indexId ? { indexId: result.indexId } : {}),
        ...(result.blobId ? { blobId: result.blobId } : {}),
      });
      setDraft(null);
    },
    [draft, onSaved],
  );

  return {
    draft,
    busy,
    error,
    start,
    cancel,
    setText: (text: string) => setDraft((current) => (current ? { ...current, text } : current)),
    setType: (type: RememberType) =>
      setDraft((current) => (current ? { ...current, type } : current)),
    submit,
  };
}
