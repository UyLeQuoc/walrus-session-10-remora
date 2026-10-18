import { type CommandTable, sanitizeTable } from "@remora/core/command-table";

export interface StoredCitation {
  blobId: string;
  type: string;
  distance: number;
}

export interface StoredMessage {
  id: string;
  role: string;
  kind: string;
  text: string;
  table?: unknown;
  cites?: unknown;
  recalled?: unknown;
  doc?: unknown;
}

export interface FileCite {
  id: string;
  name: string;
}

export interface UiCitation {
  type: string;
  text: string;
  relevance: number;
  blobId: string;
}

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  parts: Array<{ type: "text"; text: string }>;
  metadata?: {
    command?: true;
    table?: CommandTable;
    cites?: StoredCitation[];
    recalled?: UiCitation[];
    document?: FileCite;
  };
}

/** The private file an answer was built from, whether it arrived streaming or from the transcript. */
export function fileCiteOf(value: unknown): FileCite | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { id?: unknown; name?: unknown };
  return typeof row.id === "string" && typeof row.name === "string"
    ? { id: row.id, name: row.name }
    : null;
}

export function isStoredMessage(value: unknown): value is StoredMessage {
  if (!value || typeof value !== "object") return false;
  const row = value as { id?: unknown; role?: unknown; kind?: unknown; text?: unknown };
  return (
    typeof row.id === "string" &&
    (row.role === "user" || row.role === "assistant") &&
    (row.kind === "turn" || row.kind === "command") &&
    typeof row.text === "string"
  );
}

function citesOf(value: unknown): StoredCitation[] {
  if (!Array.isArray(value)) return [];
  const out: StoredCitation[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as { blobId?: unknown; type?: unknown; distance?: unknown };
    if (
      typeof row.blobId !== "string" ||
      typeof row.type !== "string" ||
      typeof row.distance !== "number"
    ) {
      continue;
    }
    out.push({ blobId: row.blobId, type: row.type, distance: row.distance });
  }
  return out;
}

function recalledOf(value: unknown): UiCitation[] {
  if (!Array.isArray(value)) return [];
  const out: UiCitation[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as { type?: unknown; text?: unknown; relevance?: unknown; blobId?: unknown };
    if (
      typeof row.type !== "string" ||
      typeof row.text !== "string" ||
      typeof row.relevance !== "number" ||
      typeof row.blobId !== "string"
    ) {
      continue;
    }
    out.push({ type: row.type, text: row.text, relevance: row.relevance, blobId: row.blobId });
  }
  return out;
}

export function toUiMessages(rows: unknown[]): UiMessage[] {
  const out: UiMessage[] = [];
  for (const row of rows) {
    if (!isStoredMessage(row)) continue;
    const table = row.role === "assistant" ? sanitizeTable(row.table) : undefined;
    const cites = citesOf(row.cites);
    const recalled = recalledOf(row.recalled);
    const document = row.role === "assistant" ? fileCiteOf(row.doc) : null;
    const metadata: NonNullable<UiMessage["metadata"]> = {
      ...(row.kind === "command" ? { command: true as const } : {}),
      ...(table ? { table } : {}),
      ...(cites.length > 0 ? { cites } : {}),
      ...(recalled.length > 0 ? { recalled } : {}),
      ...(document ? { document } : {}),
    };
    out.push({
      id: row.id,
      role: row.role as UiMessage["role"],
      parts: [{ type: "text", text: row.text }],
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    });
  }
  return out;
}

export function citationKey(
  conversationId: string | null,
  messages: Array<{ id: string; metadata?: { cites?: unknown; recalled?: unknown } }>,
): string {
  if (!conversationId) return "";
  const ids = messages.flatMap((message) => {
    const cites = message.metadata?.cites;
    const recalled = message.metadata?.recalled;
    if (!Array.isArray(cites) || cites.length === 0) return [];
    if (Array.isArray(recalled) && recalled.length > 0) return [];
    return [message.id];
  });
  return ids.length === 0 ? "" : `${conversationId}:${ids.join(",")}`;
}

export function applyResolved(
  messages: UiMessage[],
  resolved: Array<{ id: string; recalled: UiCitation[] }>,
): UiMessage[] {
  const byId = new Map(resolved.map((item) => [item.id, item.recalled]));
  return messages.map((message) => {
    if (!byId.has(message.id)) return message;
    const recalled = byId.get(message.id) ?? [];
    const metadata: NonNullable<UiMessage["metadata"]> = { ...(message.metadata ?? {}) };
    delete metadata.cites;
    if (recalled.length > 0) metadata.recalled = recalled;
    else delete metadata.recalled;
    if (Object.keys(metadata).length === 0) {
      return { id: message.id, role: message.role, parts: message.parts };
    }
    return { ...message, metadata };
  });
}

export type CitationRead = "complete" | "partial" | "unavailable";

export interface ResolvedCitations {
  status: CitationRead;
  limited: boolean;
  message: string;
  messages: Array<{ id: string; recalled: UiCitation[] }>;
}

function citationStatus(value: unknown, limited: boolean): CitationRead | null {
  if (value === "complete" || value === "partial" || value === "unavailable") return value;
  if (limited) return "unavailable";
  return "complete";
}

export function resolvedFrom(body: unknown): ResolvedCitations | null {
  if (!body || typeof body !== "object") return null;
  const row = body as {
    status?: unknown;
    limited?: unknown;
    message?: unknown;
    messages?: unknown;
  };
  const limited = row.limited === true;
  const status = citationStatus(row.status, limited);
  if (!status) return null;
  const message = typeof row.message === "string" ? row.message : "";
  if (!Array.isArray(row.messages)) {
    return limited ? { status: "unavailable", limited: true, message, messages: [] } : null;
  }
  const messages = row.messages.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const message = item as { id?: unknown; recalled?: unknown };
    if (typeof message.id !== "string") return [];
    return [{ id: message.id, recalled: recalledOf(message.recalled) }];
  });
  return { status, limited: status !== "complete", message, messages };
}
