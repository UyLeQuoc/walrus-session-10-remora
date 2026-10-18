import { useCallback, useState } from "react";
import { z } from "zod";
import { factLength, isTeamFact } from "@/features/team/team-input";
import { apiPost } from "@/lib/api-request";

const rememberReply = z.object({
  saved: z.boolean(),
  redacted: z.array(z.string()),
  message: z.string(),
});

export function useTeamRemember(onRemembered: () => Promise<void>) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const valid = isTeamFact(text);

  const submit = useCallback(async () => {
    if (!isTeamFact(text)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await apiPost(
        "/api/me/team/remember",
        rememberReply,
        "Could not add that to the team just now. Try again in a moment.",
        { text: text.trim() },
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.data.message);
      setText("");
      await onRemembered();
    } finally {
      setBusy(false);
    }
  }, [text, onRemembered]);

  return { text, setText, length: factLength(text), valid, busy, error, message, submit };
}
