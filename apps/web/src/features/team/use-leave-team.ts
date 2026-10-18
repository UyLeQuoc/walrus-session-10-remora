import { useCallback, useState } from "react";
import { z } from "zod";
import { apiPost } from "@/lib/api-request";

const leaveReply = z.object({ left: z.string() });

export function useLeaveTeam(onLeft: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const leave = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await apiPost(
        "/api/me/team/leave",
        leaveReply,
        "Could not leave just now. Try again in a moment.",
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await onLeft();
    } finally {
      setBusy(false);
    }
  }, [onLeft]);

  return { busy, error, leave };
}
