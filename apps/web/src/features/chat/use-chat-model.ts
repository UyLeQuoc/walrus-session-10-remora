/**
 * The composer's model choice (Phase 6 §4), kept in `remora.chat-model` through `lib/storage`.
 * The default is the Remora default, and an id the catalog no longer knows falls back to it.
 */
import { useCallback, useState } from "react";
import { readStored, writeStored } from "@/lib/storage";
import { DEFAULT_MODEL_ID, isKnownModelId } from "./models";

const KEY = "remora.chat-model";

export function readChatModelId(): string {
  const stored = readStored("local", KEY);
  return isKnownModelId(stored) && stored !== null ? stored : DEFAULT_MODEL_ID;
}

export function writeChatModelId(id: string): void {
  if (isKnownModelId(id)) writeStored("local", KEY, id);
}

export function useChatModel(): { id: string; select: (id: string) => void } {
  const [id, setId] = useState(readChatModelId);
  const select = useCallback((next: string) => {
    writeChatModelId(next);
    setId(next);
  }, []);
  return { id, select };
}
