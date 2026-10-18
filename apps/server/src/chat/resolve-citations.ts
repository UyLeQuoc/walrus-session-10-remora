import { hiddenBlobs, type Person, portFor } from "../identity/persons.ts";
import { type Citation, dropHidden } from "./citations.ts";
import { assembleCitationRead, type CitationReadResult, recallCitedText } from "./cited-text.ts";
import { checkRate, noteCommand } from "./ratelimit.ts";

export interface CitationMessage {
  id: string;
  cites?: Citation[];
}

export type ResolvedCitations = { ok: true } & CitationReadResult;

export async function resolveStoredCitations(
  person: Person,
  channel: string,
  messages: CitationMessage[],
): Promise<ResolvedCitations> {
  const hidden = await hiddenBlobs(person.id);
  const visible = messages
    .filter((message) => (message.cites?.length ?? 0) > 0)
    .map((message) => ({
      id: message.id,
      cites: dropHidden(message.cites ?? [], hidden),
    }));
  const pending = visible.some((message) => message.cites.length > 0);
  if (!pending) {
    return {
      ok: true,
      ...assembleCitationRead({ messages: visible, found: new Map(), reached: true }),
    };
  }
  const gate = await checkRate(person.id);
  if (!gate.allowed) {
    return {
      ok: true,
      ...assembleCitationRead({
        messages: visible,
        found: new Map(),
        reached: true,
        blocked: gate.message,
      }),
    };
  }
  await noteCommand(person.id, channel);
  const port = await portFor(person, channel);
  const looked = await recallCitedText(
    (input) => port.recall(input),
    visible.flatMap((message) => message.cites),
  );
  if (!looked.reached) {
    const err = looked.error;
    console.warn("[citations] recall failed", err instanceof Error ? err.message : err);
  }
  return {
    ok: true,
    ...assembleCitationRead({
      messages: visible,
      found: looked.found,
      reached: looked.reached,
    }),
  };
}
