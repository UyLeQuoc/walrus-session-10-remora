import { useCallback, useState } from "react";
import { z } from "zod";
import { apiGet } from "@/lib/api-request";

const teamHitSchema = z.object({
  text: z.string(),
  type: z.string().nullable(),
  relevance: z.number(),
  blobId: z.string(),
  explorerUrl: z.string().nullable(),
  mine: z.boolean(),
});

const searchReply = z.object({ results: z.array(teamHitSchema) });

export type TeamHit = z.infer<typeof teamHitSchema>;

export function useTeamSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TeamHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const search = useCallback(async () => {
    const q = query.trim();
    setError("");
    if (!q) {
      setResults(null);
      return;
    }
    setBusy(true);
    try {
      const result = await apiGet(
        `/api/me/team/search?q=${encodeURIComponent(q)}`,
        searchReply,
        "Could not search the team's memory just now. Try again in a moment.",
      );
      if (result.ok) setResults(result.data.results);
      else setError(result.error);
    } finally {
      setBusy(false);
    }
  }, [query]);

  return { query, setQuery, results, busy, error, search };
}
