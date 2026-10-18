import { useCallback, useState } from "react";
import { z } from "zod";
import { apiFetch, errorMessage } from "@/lib/api";

export type Comparison =
  | { status: "loading" }
  | { status: "done"; text: string }
  | { status: "failed"; message: string };

const compareReply = z.object({ text: z.string() });

const FAILED = "Could not answer without memory just now. Try again.";

export function useCompare(conversationId: string | null) {
  const [state, setState] = useState<{
    conversationId: string | null;
    byAnswer: Record<string, Comparison>;
  }>({ conversationId, byAnswer: {} });
  const byAnswer = state.conversationId === conversationId ? state.byAnswer : {};

  const compare = useCallback(
    async (answerId: string, userMessageId: string) => {
      if (!conversationId) return;
      const put = (comparison: Comparison) =>
        setState((prev) => ({
          conversationId,
          byAnswer: {
            ...(prev.conversationId === conversationId ? prev.byAnswer : {}),
            [answerId]: comparison,
          },
        }));
      put({ status: "loading" });
      const res = await apiFetch("/api/chat/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, messageId: userMessageId }),
      }).catch(() => null);
      if (!res) {
        put({ status: "failed", message: FAILED });
        return;
      }
      if (!res.ok) {
        put({ status: "failed", message: await errorMessage(res, FAILED) });
        return;
      }
      const body = compareReply.safeParse(await res.json().catch(() => null));
      put(
        body.success
          ? { status: "done", text: body.data.text }
          : { status: "failed", message: FAILED },
      );
    },
    [conversationId],
  );

  return { byAnswer, compare };
}

export function questionBefore(
  messages: ReadonlyArray<{ id: string; role: string }>,
  index: number,
): string | null {
  for (let i = index - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role === "user") return message.id;
    if (message?.role === "assistant") return null;
  }
  return null;
}
