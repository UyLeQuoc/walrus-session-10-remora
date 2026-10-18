import { useCallback, useState } from "react";
import { z } from "zod";
import { apiPost } from "@/lib/api-request";

export const teamInviteSchema = z.object({ code: z.string(), expiresInMinutes: z.number() });

export type TeamInvite = z.infer<typeof teamInviteSchema>;

export function useTeamInvite() {
  const [invite, setInvite] = useState<TeamInvite | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const create = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await apiPost(
        "/api/me/team/invite",
        teamInviteSchema,
        "Could not make an invite just now. Try again in a moment.",
      );
      if (result.ok) setInvite(result.data);
      else setError(result.error);
    } finally {
      setBusy(false);
    }
  }, []);

  const show = useCallback((next: TeamInvite) => {
    setInvite(next);
    setError("");
  }, []);

  const clear = useCallback(() => {
    setInvite(null);
    setError("");
  }, []);

  return { invite, busy, error, create, show, clear };
}
