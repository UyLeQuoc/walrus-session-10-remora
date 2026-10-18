import { isMemoryType, type MemoryType, replacesBlobId } from "@remora/memory";
import { type Person, portFor } from "../identity/persons.ts";

export interface RememberFactInput {
  person: Person;
  channel: string;
  type: string;
  text: string;
  replaces?: string;
}

export type RememberFactResult =
  | { ok: true; saved: boolean; indexId?: string; blobId?: string; note: string }
  | { ok: false; reason: "type" | "text" };

export async function rememberFact(input: RememberFactInput): Promise<RememberFactResult> {
  if (!isMemoryType(input.type)) return { ok: false, reason: "type" };
  const text = input.text.trim();
  if (text.length < 3 || text.length > 1000) return { ok: false, reason: "text" };
  const type: MemoryType = input.type;
  const replaces = replacesBlobId(input.replaces) ?? undefined;
  const port = await portFor(input.person, input.channel);
  const result = await port.remember({
    type,
    text,
    channel: input.channel,
    ...(replaces ? { replaces } : {}),
  });
  return {
    ok: true,
    saved: result.saved,
    note: result.note,
    ...(result.indexId ? { indexId: result.indexId } : {}),
    ...(result.blobId ? { blobId: result.blobId } : {}),
  };
}
