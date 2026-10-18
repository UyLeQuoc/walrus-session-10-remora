export interface AccountMemoryRow {
  personId: string;
  mode: string;
  accountId: string;
  stored: number | string;
  pending: number | string;
  failed: number | string;
  first: string;
  last: string;
}

export interface PersonMemoryCount {
  personId: string;
  mode: string;
  accountIds: string[];
  stored: number;
  pending: number;
  failed: number;
  first: string;
  last: string;
}

export function countPeople(rows: AccountMemoryRow[]): PersonMemoryCount[] {
  const byPerson = new Map<string, PersonMemoryCount>();
  for (const row of rows) {
    const stored = Number(row.stored);
    const pending = Number(row.pending);
    const failed = Number(row.failed);
    const existing = byPerson.get(row.personId);
    if (!existing) {
      byPerson.set(row.personId, {
        personId: row.personId,
        mode: row.mode,
        accountIds: [row.accountId],
        stored,
        pending,
        failed,
        first: row.first,
        last: row.last,
      });
      continue;
    }
    if (!existing.accountIds.includes(row.accountId)) existing.accountIds.push(row.accountId);
    existing.stored += stored;
    existing.pending += pending;
    existing.failed += failed;
    if (row.first < existing.first) existing.first = row.first;
    if (row.last > existing.last) existing.last = row.last;
    if (row.mode === "owned") existing.mode = "owned";
  }
  return [...byPerson.values()].sort(
    (a, b) => b.stored - a.stored || a.personId.localeCompare(b.personId),
  );
}

export function qualifyingPeople(people: PersonMemoryCount[], minimum = 10): PersonMemoryCount[] {
  return people.filter((person) => person.stored >= minimum);
}
