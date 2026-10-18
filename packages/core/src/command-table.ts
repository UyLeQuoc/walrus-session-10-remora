import { z } from "zod";

const MAX_CELL = 4_000;
const MAX_ROWS = 40;

const commandRowSchema = z.object({
  cells: z.array(z.string().max(MAX_CELL)).min(1).max(6),
  copy: z.string().max(MAX_CELL).optional(),
  href: z.string().max(2_000).optional(),
});

const commandTableSchema = z.object({
  lead: z.string().max(MAX_CELL).optional(),
  columns: z.array(z.string().max(80)).min(1).max(6),
  rows: z.array(commandRowSchema).min(1).max(MAX_ROWS),
  foot: z.string().max(MAX_CELL).optional(),
});

export type CommandRow = z.infer<typeof commandRowSchema>;
export type CommandTable = z.infer<typeof commandTableSchema>;

const envelopeSchema = z.object({
  v: z.literal(1),
  text: z.string(),
  table: z.unknown(),
});

/** https, or http on localhost, which is what the dev server uses for /me and connect. */
export function isOpenableUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    if (url.protocol !== "http:") return false;
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function sanitizeTable(value: unknown): CommandTable | undefined {
  const parsed = commandTableSchema.safeParse(value);
  if (!parsed.success) return undefined;
  if (parsed.data.rows.some((row) => row.cells.length !== parsed.data.columns.length)) {
    return undefined;
  }
  return {
    ...parsed.data,
    rows: parsed.data.rows.map((row) => {
      if (!row.href || isOpenableUrl(row.href)) return row;
      return {
        cells: row.cells,
        ...(row.copy ? { copy: row.copy } : {}),
      };
    }),
  };
}

export function packCommandBody(text: string, table: CommandTable): string {
  return JSON.stringify({ v: 1, text, table });
}

/** Human text, plus a table when the body is a web envelope. Anything else stays plain text. */
export function unpackCommandBody(raw: string): { text: string; table?: CommandTable } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { text: raw };
  }
  const envelope = envelopeSchema.safeParse(parsed);
  if (!envelope.success) return { text: raw };
  const table = sanitizeTable(envelope.data.table);
  return table ? { text: envelope.data.text, table } : { text: envelope.data.text };
}

/** One column, one row per non-empty line. Old stored command replies use this. */
export function proseTable(text: string): CommandTable {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_ROWS)
    .map((line) => line.slice(0, MAX_CELL));
  const rows = (lines.length > 0 ? lines : [text.slice(0, MAX_CELL) || "…"]).map((line) => ({
    cells: [line],
  }));
  return { columns: ["Detail"], rows };
}

/**
 * Assistant command bodies may be an envelope. Everything else, including the
 * person's own `/whoami`, is shown as they typed it.
 */
export function presentCommandBody(
  role: string,
  kind: string,
  raw: string,
): { text: string; table?: CommandTable } {
  if (role !== "assistant" || kind !== "command") return { text: raw };
  const opened = unpackCommandBody(raw);
  return { text: opened.text, table: opened.table ?? proseTable(opened.text) };
}
