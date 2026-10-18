export const STATUS_POLL_MS = 3_000;
export const STATUS_POLL_LIMIT_MS = 120_000;

export type WriteState = "pending" | "stored" | "failed" | "unknown";

export interface RememberedCard {
  key: string;
  type: string;
  text: string;
  saved: boolean;
  indexId?: string;
  blobId?: string;
  status: WriteState;
  startedAt: number;
  hidden: boolean;
  textKnown?: boolean;
  error?: string;
}

export function keepPolling(input: {
  status: WriteState;
  saved: boolean;
  startedAt: number;
  now: number;
  hidden: boolean;
}): boolean {
  if (!input.saved || input.hidden || input.status !== "pending") return false;
  return input.now - input.startedAt < STATUS_POLL_LIMIT_MS;
}

export function writeLabel(input: {
  saved: boolean;
  status: WriteState;
  startedAt: number;
  now: number;
  hidden: boolean;
}): string {
  if (input.hidden) return "hidden";
  if (!input.saved) return "already knew";
  if (input.status === "stored") return "on Walrus";
  if (input.status === "failed") return "could not write";
  if (input.now - input.startedAt >= STATUS_POLL_LIMIT_MS) return "still writing";
  return "writing";
}

export function canCorrect(card: RememberedCard): boolean {
  if (card.textKnown === false) return false;
  return card.text.trim().length >= 3;
}

export function parseWriteStatus(body: unknown): {
  status: WriteState;
  blobId?: string;
  hidden: boolean;
} | null {
  if (!body || typeof body !== "object") return null;
  const row = body as { status?: unknown; blobId?: unknown; hidden?: unknown };
  if (row.status !== "pending" && row.status !== "stored" && row.status !== "failed") return null;
  return {
    status: row.status,
    ...(typeof row.blobId === "string" ? { blobId: row.blobId } : {}),
    hidden: row.hidden === true,
  };
}

interface ToolPart {
  type?: unknown;
  state?: unknown;
  input?: unknown;
  output?: unknown;
}

function toolPart(value: unknown): ToolPart | null {
  if (!value || typeof value !== "object") return null;
  return value as ToolPart;
}

export function cardsFromMessages(
  messages: Array<{ id: string; parts?: Array<Record<string, unknown>> }>,
  now: number,
  startedAt: (key: string) => number,
): RememberedCard[] {
  const cards: RememberedCard[] = [];
  for (const message of messages) {
    for (const [index, raw] of (message.parts ?? []).entries()) {
      const part = toolPart(raw);
      if (part?.type !== "tool-remember" || part.state !== "output-available") continue;
      const input = part.input as { type?: unknown; text?: unknown } | undefined;
      const output = part.output as
        | { saved?: unknown; indexId?: unknown; blobId?: unknown }
        | undefined;
      const text = typeof input?.text === "string" ? input.text.trim() : "";
      const type = typeof input?.type === "string" ? input.type : "memory";
      if (!text) continue;
      const indexId = typeof output?.indexId === "string" ? output.indexId : undefined;
      const blobId = typeof output?.blobId === "string" ? output.blobId : undefined;
      const saved = output?.saved === true;
      const key = indexId ?? `${message.id}:${index}`;
      cards.push({
        key,
        type,
        text,
        saved,
        status: saved ? "pending" : "stored",
        startedAt: startedAt(key) || now,
        hidden: false,
        ...(indexId ? { indexId } : {}),
        ...(blobId ? { blobId } : {}),
      });
    }
  }
  return cards;
}

export function mergeCards(primary: RememberedCard[], extra: RememberedCard[]): RememberedCard[] {
  const byKey = new Map<string, RememberedCard>();
  for (const card of [...extra, ...primary]) {
    const prior = byKey.get(card.key);
    if (!prior) {
      byKey.set(card.key, card);
      continue;
    }
    const keepWording = card.textKnown === false && prior.textKnown !== false;
    byKey.set(card.key, {
      ...card,
      ...(keepWording ? { text: prior.text, textKnown: true } : {}),
      hidden: prior.hidden || card.hidden,
      error: prior.error,
    });
  }
  return [...byKey.values()];
}
