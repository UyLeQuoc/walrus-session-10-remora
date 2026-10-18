import { useCallback, useState } from "react";
import { z } from "zod";
import { isInviteCode, normalizeInviteCode } from "@/features/team/invite-code";
import { teamSummarySchema } from "@/hooks/use-team";
import { apiPost } from "@/lib/api-request";

const joinReply = z.object({ team: teamSummarySchema });

export function useJoinTeam(onJoined: () => Promise<void>) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const code = normalizeInviteCode(draft);
  const valid = isInviteCode(code);

  const submit = useCallback(async () => {
    if (!isInviteCode(code)) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiPost(
        "/api/me/team/join",
        joinReply,
        "Could not join just now. Try again in a moment.",
        { code },
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await onJoined();
      setDraft("");
    } finally {
      setBusy(false);
    }
  }, [code, onJoined]);

  return { draft, setDraft, valid, busy, error, submit };
}
