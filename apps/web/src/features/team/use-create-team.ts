import { useCallback, useState } from "react";
import { z } from "zod";
import { isTeamName } from "@/features/team/team-input";
import { type TeamInvite, teamInviteSchema } from "@/features/team/use-team-invite";
import { teamSummarySchema } from "@/hooks/use-team";
import { apiPost } from "@/lib/api-request";

const createReply = z.object({ team: teamSummarySchema, invite: teamInviteSchema });

export function useCreateTeam(onCreated: (invite: TeamInvite) => Promise<void>) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const valid = isTeamName(name);

  const submit = useCallback(async () => {
    if (!isTeamName(name)) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiPost(
        "/api/me/team",
        createReply,
        "Could not start the team just now. Try again in a moment.",
        { name: name.trim() },
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await onCreated(result.data.invite);
      setName("");
    } finally {
      setBusy(false);
    }
  }, [name, onCreated]);

  return { name, setName, valid, busy, error, submit };
}
