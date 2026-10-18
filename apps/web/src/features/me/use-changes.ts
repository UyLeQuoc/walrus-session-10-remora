import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export interface ChangedFact {
  blobId: string;
  text: string;
  date: string;
}

export interface Change extends ChangedFact {
  replaced: (ChangedFact & { certain: boolean }) | null;
}

function isFact(value: unknown): value is ChangedFact {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.blobId === "string" && typeof row.text === "string" && typeof row.date === "string"
  );
}

export function changesOf(body: unknown): Change[] {
  const rows = body && typeof body === "object" ? (body as { changes?: unknown }).changes : null;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!isFact(row)) return [];
    const replaced = (row as { replaced?: unknown }).replaced;
    const certain = (replaced as { certain?: unknown } | null)?.certain;
    return [
      {
        blobId: row.blobId,
        text: row.text,
        date: row.date,
        replaced:
          isFact(replaced) && typeof certain === "boolean" ? { ...replaced, certain } : null,
      },
    ];
  });
}

/** Each change is a few recalls, so the page mounts this only for someone who has corrected something. */
export function useChanges() {
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const res = await apiFetch("/api/me/changes").catch(() => null);
      if (cancelled) return;
      if (!res?.ok) {
        setError("Could not read your changes back from Walrus just now.");
        setLoading(false);
        return;
      }
      const body: unknown = await res.json().catch(() => null);
      if (cancelled) return;
      setChanges(changesOf(body));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { changes, loading, error };
}
