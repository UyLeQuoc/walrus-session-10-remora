import { describe, expect, it } from "vitest";
import {
  assembleCitationRead,
  CITATION_MISSING,
  CITATION_UNREACHABLE,
  recallCitedText,
} from "./cited-text.ts";

const cite = { blobId: "blob-keep", type: "profile", distance: 0.2 };

describe("recallCitedText", () => {
  it("keeps hits from a type that answered and stops when a later type throws", async () => {
    const queries: string[] = [];
    const looked = await recallCitedText(
      async (input) => {
        queries.push(input.query);
        if (input.query === "[profile]") {
          return [{ blob_id: "blob-keep", text: "[profile] raw", parsed: { text: "I use pnpm" } }];
        }
        throw new Error("relayer down");
      },
      [cite, { type: "profile" }, { type: "decision" }],
    );
    expect(queries).toEqual(["[profile]", "[decision]"]);
    expect(looked.reached).toBe(false);
    expect(looked.found.get("blob-keep")).toBe("I use pnpm");
  });

  it("asks for an unknown type by its name and keeps the raw text when nothing was parsed", async () => {
    const looked = await recallCitedText(
      async () => [{ blob_id: "blob-raw", text: "plain line", parsed: null }],
      [{ type: "note" }],
    );
    expect(looked.reached).toBe(true);
    expect(looked.found.get("blob-raw")).toBe("plain line");
  });

  it("does not call recall when there is nothing to resolve", async () => {
    const recall = async () => {
      throw new Error("should not run");
    };
    await expect(recallCitedText(recall, [])).resolves.toEqual({
      found: new Map(),
      reached: true,
    });
  });
});

describe("assembleCitationRead", () => {
  const messages = [
    {
      id: "a1",
      cites: [cite, { blobId: "blob-miss", type: "profile", distance: 0.4 }],
    },
  ];

  it("is complete only when every visible blob came back", () => {
    const read = assembleCitationRead({
      messages: [{ id: "a1", cites: [cite] }],
      found: new Map([["blob-keep", "I use pnpm"]]),
      reached: true,
    });
    expect(read.status).toBe("complete");
    expect(read.limited).toBe(false);
    expect(read.messages[0]?.recalled.map((item) => item.text)).toEqual(["I use pnpm"]);
  });

  it("keeps the facts it found when one blob is missing", () => {
    const read = assembleCitationRead({
      messages,
      found: new Map([["blob-keep", "I use pnpm"]]),
      reached: true,
    });
    expect(read.status).toBe("partial");
    expect(read.message).toBe(CITATION_MISSING);
    expect(read.messages[0]?.recalled.map((item) => item.blobId)).toEqual(["blob-keep"]);
  });

  it("does not pretend a failed recall found nothing on purpose", () => {
    const read = assembleCitationRead({
      messages,
      found: new Map(),
      reached: false,
    });
    expect(read.status).toBe("unavailable");
    expect(read.message).toBe(CITATION_UNREACHABLE);
    expect(read.messages[0]?.recalled).toEqual([]);
  });

  it("keeps what it already found when a later type cannot be reached", () => {
    const read = assembleCitationRead({
      messages,
      found: new Map([["blob-keep", "I use pnpm"]]),
      reached: false,
    });
    expect(read.status).toBe("partial");
    expect(read.message).toBe(CITATION_UNREACHABLE);
    expect(read.messages[0]?.recalled).toHaveLength(1);
  });

  it("is complete when every cite was hidden before lookup", () => {
    const read = assembleCitationRead({
      messages: [{ id: "a1", cites: [] }],
      found: new Map(),
      reached: true,
    });
    expect(read).toEqual({
      status: "complete",
      limited: false,
      messages: [{ id: "a1", recalled: [] }],
    });
  });

  it("keeps a rate-limit sentence and does not invent recalled text", () => {
    const read = assembleCitationRead({
      messages,
      found: new Map([["blob-keep", "I use pnpm"]]),
      reached: true,
      blocked: "Give me a minute.",
    });
    expect(read.status).toBe("unavailable");
    expect(read.message).toBe("Give me a minute.");
    expect(read.messages[0]?.recalled).toEqual([]);
  });
});
