export type PanelChoice = "open" | "closed";

export function parsePanelChoice(value: string | null): PanelChoice | null {
  return value === "open" || value === "closed" ? value : null;
}

export function panelOpen(choice: PanelChoice | null): boolean {
  return choice !== "closed";
}

export function panelShown(mobile: boolean, desktopOpen: boolean, sheetOpen: boolean): boolean {
  return mobile ? sheetOpen : desktopOpen;
}
