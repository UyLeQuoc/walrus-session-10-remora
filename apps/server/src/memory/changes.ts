import type { MemoryPort, RecalledMemory } from "@remora/memory";

export interface ChangedFact {
  blobId: string;
  text: string;
  date: string;
}

export interface Change extends ChangedFact {
  /** What the correction replaced. `certain` when the correction names its blob. */
  replaced: (ChangedFact & { certain: boolean }) | null;
}

/** Closer than this, an older fact on the same subject is what a correction most likely replaced. */
const SAME_SUBJECT = 0.6;

function fact(m: RecalledMemory): ChangedFact {
  return {
    blobId: m.blob_id,
    text: m.parsed?.text ?? m.text,
    date: m.created_at ?? m.parsed?.date ?? "",
  };
}

/**
 * Pair a correction with the fact it replaced. A correction made from the
 * memory panel names the blob in `[replaces:…]`, and that is certain. One the
 * model wrote only says so in words, so the nearest older non-correction on
 * the same subject is offered as "probably", never as fact.
 */
export function pairChange(correction: RecalledMemory, nearby: RecalledMemory[]): Change {
  const named = correction.parsed?.tags.replaces;
  if (named) {
    const hit = nearby.find((m) => m.blob_id === named);
    return { ...fact(correction), replaced: hit ? { ...fact(hit), certain: true } : null };
  }
  const when = fact(correction).date;
  const guess = nearby
    .filter(
      (m) =>
        m.blob_id !== correction.blob_id &&
        m.parsed?.type !== "correction" &&
        m.distance <= SAME_SUBJECT &&
        (!when || !fact(m).date || fact(m).date <= when),
    )
    .sort((a, b) => a.distance - b.distance)[0];
  return { ...fact(correction), replaced: guess ? { ...fact(guess), certain: false } : null };
}

export async function memoryChanges(port: MemoryPort): Promise<Change[]> {
  const corrections = (await port.recall({ query: "[correction]", limit: 12 })).filter(
    (m) => m.parsed?.type === "correction",
  );
  const out: Change[] = [];
  for (const correction of corrections) {
    const nearby = await port.recall({
      query: correction.parsed?.text ?? correction.text,
      limit: 6,
    });
    out.push(pairChange(correction, nearby));
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
