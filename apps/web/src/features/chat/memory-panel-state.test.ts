import { describe, expect, it } from "vitest";
import { panelOpen, panelShown, parsePanelChoice } from "./memory-panel-state.ts";

describe("memory panel choice", () => {
  it("opens on the first visit and stays closed after the person closes it", () => {
    expect(parsePanelChoice(null)).toBeNull();
    expect(panelOpen(null)).toBe(true);
    expect(panelOpen("closed")).toBe(false);
    expect(panelOpen("open")).toBe(true);
    expect(parsePanelChoice("nope")).toBeNull();
  });

  it("never opens the sheet over the chat on a phone until the person asks", () => {
    expect(panelShown(true, true, false)).toBe(false);
    expect(panelShown(true, false, true)).toBe(true);
    expect(panelShown(false, true, false)).toBe(true);
    expect(panelShown(false, false, true)).toBe(false);
  });
});
