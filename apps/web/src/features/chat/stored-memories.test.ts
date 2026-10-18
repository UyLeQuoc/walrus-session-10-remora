import { describe, expect, it } from "vitest";
import { canCorrect } from "./remembered.ts";
import { cardsFromStored, mergeLoadedCards } from "./stored-memories.ts";

describe("cardsFromStored", () => {
  const now = 1_000;

  it("keeps a real fact and will not correct a placeholder", () => {
    const cards = cardsFromStored(
      {
        memories: [
          {
            id: "known",
            type: "profile",
            text: "  I use pnpm  ",
            status: "stored",
            blobId: "blob-1",
          },
          { id: "missing", type: "profile", text: null, status: "stored", blobId: "blob-2" },
          { id: "writing", type: "profile", status: "pending" },
          { id: "bad" },
          { nope: true },
        ],
      },
      now,
    );
    expect(cards.map((card) => card.key)).toEqual(["known", "missing", "writing"]);
    expect(cards[0]).toMatchObject({ text: "I use pnpm", textKnown: true, status: "stored" });
    expect(canCorrect(cards[0])).toBe(true);
    expect(cards[1]?.text).toMatch(/did not come back/);
    expect(canCorrect(cards[1])).toBe(false);
    expect(cards[2]).toMatchObject({
      text: "Writing to Walrus.",
      status: "pending",
      textKnown: false,
    });
    expect(canCorrect(cards[2])).toBe(false);
  });

  it("marks a hidden row hidden and ignores a body that is not a list", () => {
    const cards = cardsFromStored(
      {
        memories: [{ id: "h", type: "gotcha", text: "port 5433", status: "stored", hidden: true }],
      },
      now,
    );
    expect(cards[0]?.hidden).toBe(true);
    expect(cardsFromStored(null, now)).toEqual([]);
    expect(cardsFromStored({ memories: "nope" }, now)).toEqual([]);
  });

  it("does not let a stale pending list erase a write that already landed", () => {
    const now = 1_000;
    const landed = cardsFromStored(
      {
        memories: [
          { id: "m", type: "profile", text: "I use pnpm", status: "stored", blobId: "blob-1" },
        ],
      },
      now,
    ).map((card) => ({ ...card, hidden: true }));
    const stale = cardsFromStored(
      { memories: [{ id: "m", type: "profile", status: "pending" }] },
      now,
    );
    const merged = mergeLoadedCards(landed, stale);
    expect(merged[0]).toMatchObject({
      status: "stored",
      blobId: "blob-1",
      text: "I use pnpm",
      textKnown: true,
      hidden: true,
    });
  });
});
