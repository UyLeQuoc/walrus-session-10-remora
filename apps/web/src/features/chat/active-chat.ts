const KEY = "hippo.activeChat";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readActiveChat(): string | null {
  try {
    const value = sessionStorage.getItem(KEY);
    return value && UUID.test(value) ? value : null;
  } catch {
    return null;
  }
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
