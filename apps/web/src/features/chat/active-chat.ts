import { readStored } from "@/lib/storage";

const KEY = "remora.activeChat";
const OLD_KEY = "hippo.activeChat";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readActiveChat(): string | null {
  const value = readStored("session", KEY, OLD_KEY);
  return value && UUID.test(value) ? value : null;
}

export function writeActiveChat(id: string): void {
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    // Private browsing. The chat still works until the tab closes.
  }
}

export function clearActiveChat(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}
