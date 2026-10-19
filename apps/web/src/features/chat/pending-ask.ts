/** Remembers the chat text across the deliberate reload in the demo, now under a Remora key. */
import { readStored, removeStored, writeStored } from "@/lib/storage";

const PENDING_KEY = "remora.pendingAsk";
const OLD_KEY = "hippo.pendingAsk";

export function rememberPendingAsk(text: string): void {
  writeStored("session", PENDING_KEY, text);
}

export function takePendingAsk(): string | null {
  const value = readStored("session", PENDING_KEY, OLD_KEY);
  if (value !== null) removeStored("session", PENDING_KEY, OLD_KEY);
  return value;
}
