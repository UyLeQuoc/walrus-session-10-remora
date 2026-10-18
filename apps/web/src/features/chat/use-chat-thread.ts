import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useMemo, useRef, useState } from "react";
import { useAdoptChat } from "@/app/shell";
import { readActiveChat, writeActiveChat } from "@/features/chat/active-chat";
import { resendThread } from "@/features/chat/resend-thread";
import { API_URL, identityHeaders } from "@/lib/api";

function textOfMessage(
  message: { parts?: Array<{ type: string; text?: string }> } | undefined,
): string {
  return (message?.parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

function outboundMessage(
  messages: UIMessage[],
  trigger: "submit-message" | "regenerate-message",
  messageId: string | undefined,
): UIMessage | undefined {
  if (trigger !== "regenerate-message") return messages.at(-1);
  const idx = messageId ? messages.findIndex((message) => message.id === messageId) : -1;
  const prior = idx >= 0 ? messages.slice(0, idx + 1) : messages;
  return [...prior].reverse().find((message) => message.role === "user") ?? messages.at(-1);
}

function lastUserText(messages: readonly UIMessage[]): string {
  const last = [...messages].reverse().find((message) => message.role === "user");
  return textOfMessage(last);
}

export function useChatThread() {
  const idRef = useRef<string | null>(readActiveChat());
  const documentRef = useRef<{ id: string; text: string } | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(() => readActiveChat());
  const adoptChat = useAdoptChat();
  const adoptRef = useRef(adoptChat);
  adoptRef.current = adoptChat;
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_URL}/api/chat`,
        credentials: "include",
        headers: identityHeaders,
        prepareSendMessagesRequest: ({ messages, trigger, messageId }) => {
          const source = outboundMessage(messages, trigger, messageId);
          if (!idRef.current) {
            const id = crypto.randomUUID();
            idRef.current = id;
            setConversationId(id);
            writeActiveChat(id);
            adoptRef.current(id);
          }
          return {
            body: {
              text: textOfMessage(source),
              conversationId: idRef.current,
              clientMessageId: source?.id,
              regenerate: trigger === "regenerate-message",
              ...(documentRef.current ? { document: documentRef.current } : {}),
            },
          };
        },
      }),
    [],
  );
  const { messages, sendMessage, setMessages, status, error, stop, regenerate } = useChat({
    transport,
  });
  const busy = status === "submitted" || status === "streaming";

  const resetConversation = useCallback(() => {
    idRef.current = null;
    setConversationId(null);
    setMessages([]);
  }, [setMessages]);

  const openConversation = useCallback(
    (id: string | null) => {
      idRef.current = id;
      setConversationId(id);
      if (!id) setMessages([]);
    },
    [setMessages],
  );

  const setDocument = useCallback((document: { id: string; text: string } | null) => {
    documentRef.current = document;
  }, []);

  const replaceMessages = useCallback(
    (next: UIMessage[]) => {
      setMessages(next);
    },
    [setMessages],
  );

  const send = (value: string) => {
    const text = value.trim();
    if (!text || busy) return;
    if (!idRef.current) {
      const id = crypto.randomUUID();
      idRef.current = id;
      setConversationId(id);
      writeActiveChat(id);
      adoptRef.current(id);
    }
    void sendMessage({ text });
  };

  const resend = (text: string) => {
    if (busy) return;
    const next = resendThread(messages, text);
    if (!next) return;
    setMessages(next.messages);
    void regenerate({ messageId: next.userMessageId });
  };

  return {
    messages,
    status,
    busy,
    error,
    conversationId,
    send,
    stop: () => void stop(),
    retry: () => resend(lastUserText(messages)),
    edit: (text: string) => resend(text),
    replaceMessages,
    resetConversation,
    openConversation,
    setDocument,
  };
}
