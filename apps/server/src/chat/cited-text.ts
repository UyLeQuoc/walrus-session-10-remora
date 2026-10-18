import { isMemoryType } from "@remora/memory";
import { type Citation, type CitedFact, factsFromLookup } from "./citations.ts";

export const CITATION_MISSING = "Could not read every source back from Walrus just now. Try again.";
export const CITATION_UNREACHABLE = "Walrus Memory could not be reached just now. Try again.";

export interface CitedHit {
  blob_id: string;
  text: string;
  parsed?: { text?: string } | null;
}

export type CitedRecall = (input: {
  query: string;
  limit: number;
  maxDistance: number;
}) => Promise<CitedHit[]>;

export type CitedLookup =
  | { found: Map<string, string>; reached: true }
  | { found: Map<string, string>; reached: false; error: unknown };

export async function recallCitedText(
  recall: CitedRecall,
  cites: Array<{ type: string }>,
): Promise<CitedLookup> {
  const found = new Map<string, string>();
  const types = [...new Set(cites.map((cite) => cite.type))];
  for (const type of types) {
    try {
      const hits = await recall({
        query: isMemoryType(type) ? `[${type}]` : type,
        limit: 100,
        maxDistance: 2,
      });
      for (const hit of hits) {
        if (found.has(hit.blob_id)) continue;
        found.set(hit.blob_id, hit.parsed?.text ?? hit.text);
      }
    } catch (error) {
      return { found, reached: false, error };
    }
  }
  return { found, reached: true };
}

export type CitationRead = "complete" | "partial" | "unavailable";

export interface CitationReadResult {
  status: CitationRead;
  limited: boolean;
  message?: string;
  messages: Array<{ id: string; recalled: CitedFact[] }>;
}

export function assembleCitationRead(input: {
  messages: Array<{ id: string; cites: Citation[] }>;
  found: ReadonlyMap<string, string>;
  reached: boolean;
  blocked?: string;
}): CitationReadResult {
  const messages = input.messages.map((message) => ({
    id: message.id,
    recalled: factsFromLookup(message.cites, input.found),
  }));
  if (input.blocked) {
    return {
      status: "unavailable",
      limited: true,
      message: input.blocked,
      messages: messages.map((message) => ({ id: message.id, recalled: [] })),
    };
  }
  const wanted = input.messages.reduce((count, message) => count + message.cites.length, 0);
  const got = messages.reduce((count, message) => count + message.recalled.length, 0);
  if (wanted === 0) return { status: "complete", limited: false, messages };
  if (!input.reached && got === 0) {
    return { status: "unavailable", limited: true, message: CITATION_UNREACHABLE, messages };
  }
  if (!input.reached || got < wanted) {
    return {
      status: "partial",
      limited: true,
      message: input.reached ? CITATION_MISSING : CITATION_UNREACHABLE,
      messages,
    };
  }
  return { status: "complete", limited: false, messages };
}
