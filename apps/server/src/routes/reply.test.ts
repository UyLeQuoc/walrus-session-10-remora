import { describe, expect, it } from "vitest";
import { plainReply } from "./reply.ts";

/** The text `useChat` would assemble from a UI message stream body. */
function streamedText(body: string): string {
  return body
    .split("\n")
    .filter((l) => l.startsWith("data: "))
    .map((l) => {
      try {
        return JSON.parse(l.slice(6)) as { type?: string; delta?: string };
      } catch {
        return {};
      }
    })
    .filter((e) => e.type === "text-delta")
    .map((e) => e.delta ?? "")
    .join("");
}

describe("plainReply", () => {
  it("gives the web chat a stream it can render, not JSON it silently drops", async () => {
    const res = plainReply("web", "/memory     what I remember about you");
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const body = await res.text();
    expect(streamedText(body)).toBe("/memory     what I remember about you");
    // Marked as a command, so the page does not treat it as something taught.
    expect(body).toContain('"messageMetadata":{"command":true}');
  });

  it("sends the table with the text on the web, and still not in the CLI json", async () => {
    const table = {
      columns: ["Field", "Value"],
      rows: [{ cells: ["Namespace", "hippo"], copy: "hippo" }],
    };
    const web = await plainReply("web", "Mode: guest.", undefined, table).text();
    expect(streamedText(web)).toBe("Mode: guest.");
    expect(web).toContain('"command":true');
    expect(web).toContain('"copy":"hippo"');
    const cli = await plainReply("cli", "Mode: guest.", undefined, table).json();
    expect(cli).toEqual({ command: true, text: "Mode: guest." });
  });

  it("keeps JSON for the CLI, with the files /export hands back", async () => {
    const files = [{ name: "hippo-memory.md", mime: "text/markdown", content: "# x" }];
    const res = plainReply("cli", "Your memory, as files you keep.", files);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({
      command: true,
      text: "Your memory, as files you keep.",
      files,
    });
  });
});
