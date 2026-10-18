import { describe, expect, it } from "vitest";
import {
  commandRoot,
  commandUsages,
  filterSlashCommands,
  SLASH_ITEMS,
  slashDraft,
  slashKeyAction,
} from "./slash-menu";

describe("slashDraft", () => {
  it("opens only when the draft itself is a command", () => {
    expect(slashDraft("/")).toBe("");
    expect(slashDraft("/mem")).toBe("mem");
    expect(slashDraft("hello")).toBeNull();
    expect(slashDraft("see /memory")).toBeNull();
    expect(slashDraft("/memory\nmore")).toBeNull();
  });
});

describe("filterSlashCommands", () => {
  it("lists every command when the draft is just a slash", () => {
    expect(filterSlashCommands("").map((item) => item.command)).toEqual(
      SLASH_ITEMS.map((item) => item.command),
    );
  });

  it("narrows by the command name", () => {
    expect(filterSlashCommands("who").map((item) => item.command)).toEqual(["/whoami"]);
  });

  it("keeps the memory toggles beside memory", () => {
    expect(filterSlashCommands("memory").map((item) => item.command)).toEqual([
      "/memory",
      "/memory on",
      "/memory off",
    ]);
  });
});

describe("commandRoot", () => {
  it("keeps the family when the box holds a form of the command", () => {
    expect(commandRoot("/team")).toBe("/team");
    expect(commandRoot("/team new <name>")).toBe("/team");
    expect(commandRoot("/memory on")).toBe("/memory");
    expect(commandRoot("hello")).toBeNull();
  });

  it("lists the forms under that command", () => {
    expect(commandUsages("/team").map((line) => line.command)).toContain("/team new <name>");
    expect(commandUsages("/whoami")).toEqual([
      { command: "/whoami", description: "your account and where the memory lives" },
    ]);
  });
});

describe("slashKeyAction", () => {
  it("runs the highlighted command on Enter and does not move the caret", () => {
    expect(slashKeyAction("Enter", 1, 3)).toEqual({ type: "run", index: 1 });
    expect(slashKeyAction("ArrowDown", 1, 3)).toEqual({ type: "move", index: 2 });
    expect(slashKeyAction("ArrowUp", 0, 3)).toEqual({ type: "move", index: 2 });
    expect(slashKeyAction("Escape", 0, 3)).toEqual({ type: "dismiss" });
    expect(slashKeyAction("a", 0, 3)).toEqual({ type: "ignore" });
  });
});
