/**
 * How a reply that is not the model's reaches each client.
 *
 * Slash commands, the size guard and the rate limit answer without calling the
 * model. They used to answer with JSON everywhere, which suits the CLI and is
 * silently invisible in the web chat: `useChat` reads the response as a UI
 * message stream, finds no events in a JSON body, and shows nothing — no reply,
 * no error. Every command typed on the web, `/help` included, went nowhere.
 *
 * So the web gets the same text as a one-message stream, and the CLI keeps its
 * JSON, which also carries the files `/export` hands back. No imports from the
 * environment or the database, so this is tested in CI.
 */
import type { CommandTable } from "@remora/core/command-table";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

export interface ReplyFile {
  name: string;
  mime: string;
  content: string;
}

export function plainReply(
  channel: string,
  text: string,
  files?: ReplyFile[],
  table?: CommandTable,
): Response {
  if (channel === "cli") return Response.json({ command: true, text, files });
  return textReply(text, true, table);
}

/** A stored answer replayed as a stream, so a retry does not call the model again. */
export function textReply(text: string, command = false, table?: CommandTable): Response {
  const id = "reply";
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({
        type: "start",
        ...(command ? { messageMetadata: { command: true, ...(table ? { table } : {}) } } : {}),
      });
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: text });
      writer.write({ type: "text-end", id });
    },
  });
  return createUIMessageStreamResponse({ stream });
}
