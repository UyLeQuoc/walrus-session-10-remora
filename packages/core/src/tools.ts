import { MEMORY_TYPES, type MemoryPort } from "@remora/memory";
import { tool } from "ai";
import { z } from "zod";

export function createTools(port: MemoryPort, channel: string, knownHashes?: ReadonlySet<string>) {
  return {
    remember: tool({
      description:
        "Store one durable fact about the user in their Walrus Memory. Call proactively in the same turn the fact is stated. One fact per call, in the user's own words, absolute dates.",
      inputSchema: z.object({
        type: z.enum(MEMORY_TYPES),
        text: z.string().min(3).max(1000).describe("The complete fact, not a summary."),
      }),
      execute: async ({ type, text }) => port.remember({ type, text, channel, knownHashes }),
      toModelOutput: ({ output }) => ({
        type: "json",
        value: { saved: output.saved, note: output.note, redacted: output.redacted },
      }),
    }),
    recall: tool({
      description:
        "Search the user's Walrus Memory by meaning. Use only when the user refers to something from the past that is not already in the conversation.",
      inputSchema: z.object({
        query: z.string().min(2).max(300),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      execute: async ({ query, limit }) => {
        const hits = await port.recall({ query, limit });
        return hits.map((h) => ({
          text: h.text,
          relevance: Number((1 - h.distance).toFixed(2)),
          blobId: h.blob_id,
        }));
      },
    }),
  };
}
export type HippoTools = ReturnType<typeof createTools>;
