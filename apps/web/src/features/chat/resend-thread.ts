import type { UIMessage } from "ai";

export interface ResendThread {
  messages: UIMessage[];
  userMessageId: string;
}

function withText(message: UIMessage, text: string): UIMessage {
  const rest = message.parts.filter((part) => part.type !== "text");
  return { ...message, parts: [...rest, { type: "text", text }] };
}

export function resendThread(
  messages: readonly UIMessage[],
  nextText: string,
): ResendThread | null {
  const text = nextText.trim();
  if (!text) return null;
  let index = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") {
      index = i;
      break;
    }
  }
  const current = index >= 0 ? messages[index] : undefined;
  if (!current) return null;
  return {
    messages: [...messages.slice(0, index), withText(current, text)],
    userMessageId: current.id,
  };
}
