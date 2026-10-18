export function membersLabel(count: number): string {
  return `${count} ${count === 1 ? "member" : "members"}`;
}

export function sharedCounts(memories: ReadonlyArray<{ mine: boolean }>): {
  shared: number;
  mine: number;
} {
  return { shared: memories.length, mine: memories.filter((memory) => memory.mine).length };
}
