export const POLL_EVERY_MS = 5_000;
export const POLL_FOR_MS = 120_000;

export function hasPending(memories: ReadonlyArray<{ status: string }>): boolean {
  return memories.some((memory) => memory.status === "pending");
}

export function shouldKeepPolling(
  memories: ReadonlyArray<{ status: string }>,
  startedAt: number,
  now: number,
): boolean {
  return hasPending(memories) && now - startedAt < POLL_FOR_MS;
}
