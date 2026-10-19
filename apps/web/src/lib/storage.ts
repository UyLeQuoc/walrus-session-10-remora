/**
 * Keys the browser keeps for Remora, with a one-way migration from the hippo names (D10).
 *
 * Every access is guarded: localStorage throws in a private window, and the page must render the
 * same without it. Reading an old key writes the new one, then deletes the old one, so the
 * migration happens once and a later rename does not need a second migration.
 */

export type Area = "local" | "session";

function area(kind: Area): Storage | null {
  try {
    return kind === "local" ? localStorage : sessionStorage;
  } catch {
    return null;
  }
}

export function readStored(kind: Area, key: string, oldKey?: string): string | null {
  const store = area(kind);
  if (!store) return null;
  try {
    const current = store.getItem(key);
    if (current !== null) return current;
    if (!oldKey) return null;
    const previous = store.getItem(oldKey);
    if (previous === null) return null;
    store.setItem(key, previous);
    store.removeItem(oldKey);
    return previous;
  } catch {
    return null;
  }
}

export function writeStored(kind: Area, key: string, value: string): void {
  try {
    area(kind)?.setItem(key, value);
  } catch {
    // The choice just will not survive a reload.
  }
}

export function removeStored(kind: Area, key: string, oldKey?: string): void {
  const store = area(kind);
  if (!store) return;
  try {
    store.removeItem(key);
    if (oldKey) store.removeItem(oldKey);
  } catch {
    // Nothing stored.
  }
}
