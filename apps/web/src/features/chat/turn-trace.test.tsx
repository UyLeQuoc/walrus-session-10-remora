/** The steps under an answer: recalled memories, a file, and each memory tool call. */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TurnTrace } from "./turn-trace";

const memory = { type: "profile", text: "I use pnpm", relevance: 0.9, blobId: "blob-1" };

describe("TurnTrace", () => {
  it("renders nothing when the remora did nothing worth showing", () => {
    const { container } = render(<TurnTrace recalled={[]} file={null} tools={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("keeps recalled memories folded until asked, and links each to its blob", async () => {
    const user = userEvent.setup();
    render(<TurnTrace recalled={[memory]} file={null} tools={[]} />);
    expect(screen.queryByText("I use pnpm")).toBeNull();
    await user.click(screen.getByRole("button", { name: /recalled 1 memory/i }));
    expect(screen.getByText("I use pnpm")).toBeDefined();
    expect(screen.getByRole("link", { name: "blob" }).getAttribute("href")).toContain("blob-1");
  });

  it("marks a running tool call and words a finished one in the past tense", () => {
    const { container, rerender } = render(
      <TurnTrace
        recalled={[]}
        file={{ name: "notes.md" }}
        tools={[{ type: "tool-remember", state: "input-available", input: { text: "bun" } }]}
      />,
    );
    expect(screen.getByText("Read your file notes.md")).toBeDefined();
    expect(screen.getByText("Remembering: bun")).toBeDefined();
    expect(container.querySelector('[data-status="running"]')).not.toBeNull();

    rerender(
      <TurnTrace
        recalled={[]}
        file={null}
        tools={[
          {
            type: "tool-remember",
            state: "output-available",
            input: { text: "bun" },
            output: { saved: false },
          },
          { type: "tool-recall", state: "output-available" },
        ]}
      />,
    );
    expect(screen.getByText("Already knew: bun")).toBeDefined();
    expect(screen.getByText("Searched memory")).toBeDefined();
    expect(container.querySelector('[data-status="running"]')).toBeNull();
  });
});
