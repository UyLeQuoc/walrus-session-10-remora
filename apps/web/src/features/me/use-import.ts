import { IMPORT_TYPES, type ImportedFact } from "@remora/core/import-facts";
import { useCallback, useState } from "react";
import { z } from "zod";
import { apiFetch, errorMessage } from "@/lib/api";

export interface CandidateFact extends ImportedFact {
  keep: boolean;
}

const previewReply = z.object({
  facts: z.array(z.object({ type: z.enum(IMPORT_TYPES), text: z.string() })),
});

const keepReply = z.object({ saved: z.number(), known: z.number(), failed: z.number() });

export function useImport(onSaved: () => void) {
  const [text, setText] = useState("");
  const [facts, setFacts] = useState<CandidateFact[]>([]);
  const [phase, setPhase] = useState<"idle" | "finding" | "saving">("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const find = useCallback(async () => {
    setPhase("finding");
    setError("");
    setMessage("");
    try {
      const res = await apiFetch("/api/me/import/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        setError(await errorMessage(res, "Could not read that note just now."));
        return;
      }
      const body = previewReply.safeParse(await res.json().catch(() => null));
      const found = body.success ? body.data.facts : [];
      setFacts(found.map((fact) => ({ ...fact, keep: true })));
      if (found.length === 0) setMessage("No facts about you came out of that note.");
    } finally {
      setPhase("idle");
    }
  }, [text]);

  const toggle = useCallback((index: number) => {
    setFacts((current) =>
      current.map((fact, i) => (i === index ? { ...fact, keep: !fact.keep } : fact)),
    );
  }, []);

  const save = useCallback(async () => {
    const kept = facts
      .filter((fact) => fact.keep)
      .map(({ type, text: fact }) => ({ type, text: fact }));
    if (kept.length === 0) return;
    setPhase("saving");
    setError("");
    try {
      const res = await apiFetch("/api/me/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ facts: kept }),
      });
      if (!res.ok) {
        setError(await errorMessage(res, "Could not keep those facts just now."));
        return;
      }
      const body = keepReply.safeParse(await res.json().catch(() => null));
      setMessage(
        body.success
          ? `Kept ${body.data.saved}. Already known: ${body.data.known}. Could not keep: ${body.data.failed}. Each lands on Walrus in about half a minute.`
          : "Sent. Your memories below show what landed.",
      );
      setFacts([]);
      setText("");
      onSaved();
    } finally {
      setPhase("idle");
    }
  }, [facts, onSaved]);

  return {
    text,
    setText,
    facts,
    toggle,
    find,
    save,
    finding: phase === "finding",
    saving: phase === "saving",
    message,
    error,
  };
}
