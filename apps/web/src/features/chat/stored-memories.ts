import type { RememberedCard, WriteState } from "@/features/chat/remembered";

export function mergeLoadedCards(
  previous: readonly RememberedCard[],
  next: RememberedCard[],
): RememberedCard[] {
  const prior = new Map(previous.map((card) => [card.key, card]));
  return next.map((card) => {
    const old = prior.get(card.key);
    if (!old) return card;
    const hidden = old.hidden || card.hidden;
    if (old.status === "stored" && card.status === "pending") {
      return {
        ...card,
        status: "stored",
        hidden,
        text: card.textKnown ? card.text : old.text,
        textKnown: card.textKnown || old.textKnown === true,
        ...(old.blobId ? { blobId: old.blobId } : {}),
      };
    }
    return hidden ? { ...card, hidden } : card;
  });
}

export function cardsFromStored(body: unknown, now: number): RememberedCard[] {
  if (!body || typeof body !== "object") return [];
  const rows = (body as { memories?: unknown }).memories;
  if (!Array.isArray(rows)) return [];
  const cards: RememberedCard[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const row = item as {
      id?: unknown;
      type?: unknown;
      text?: unknown;
      status?: unknown;
      blobId?: unknown;
      hidden?: unknown;
    };
    if (typeof row.id !== "string" || typeof row.type !== "string") continue;
    const status = writeState(row.status);
    const fact = typeof row.text === "string" ? row.text.trim() : "";
    cards.push({
      key: row.id,
      type: row.type,
      text:
        fact !== ""
          ? fact
          : status === "stored"
            ? "On Walrus. The wording did not come back just now."
            : "Writing to Walrus.",
      textKnown: fact !== "",
      saved: status !== "failed",
      status,
      startedAt: now,
      hidden: row.hidden === true,
      indexId: row.id,
      ...(typeof row.blobId === "string" ? { blobId: row.blobId } : {}),
    });
  }
  return cards;
}

function writeState(value: unknown): WriteState {
  if (value === "pending" || value === "stored" || value === "failed") return value;
  return "unknown";
}
