const CREATE_TABLE = /^\s*CREATE TABLE\s+"([^"]+)"/i;
const SAFE_ON_ANY_TABLE = /^\s*(?:ALTER TABLE\s+"[^"]+"\s+ADD COLUMN|CREATE INDEX)\b/i;
const FOREIGN_KEY = /^\s*ALTER TABLE\s+"([^"]+)"\s+ADD CONSTRAINT\s+"[^"]+"\s+FOREIGN KEY\b/i;
const UNIQUE_INDEX = /^\s*CREATE UNIQUE INDEX\s+"[^"]+"\s+ON\s+"([^"]+)"/i;

/**
 * A foreign key or a unique index fails on rows that already break it, partway
 * through an apply, so they count as additive only on a table this same plan
 * creates, which has no rows yet.
 */
export function isAdditive(statements: readonly string[]): boolean {
  const created = new Set(statements.flatMap((st) => CREATE_TABLE.exec(st)?.slice(1, 2) ?? []));
  return statements.every((st) => {
    if (CREATE_TABLE.test(st) || SAFE_ON_ANY_TABLE.test(st)) return true;
    const table = FOREIGN_KEY.exec(st)?.[1] ?? UNIQUE_INDEX.exec(st)?.[1];
    return table !== undefined && created.has(table);
  });
}
