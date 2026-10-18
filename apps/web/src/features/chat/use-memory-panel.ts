import { useCallback, useEffect, useState } from "react";
import {
  type PanelChoice,
  panelOpen,
  panelShown,
  parsePanelChoice,
} from "@/features/chat/memory-panel-state";

const KEY = "hippo.memory-panel";
const SIDE_BY_SIDE_FROM = 1280;

function useOverlay(): boolean {
  const [overlay, setOverlay] = useState(() => window.innerWidth < SIDE_BY_SIDE_FROM);
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${SIDE_BY_SIDE_FROM - 1}px)`);
    const update = () => setOverlay(window.innerWidth < SIDE_BY_SIDE_FROM);
    query.addEventListener("change", update);
    update();
    return () => query.removeEventListener("change", update);
  }, []);
  return overlay;
}

function readChoice(): PanelChoice | null {
  try {
    return parsePanelChoice(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

function writeChoice(open: boolean): void {
  try {
    localStorage.setItem(KEY, open ? "open" : "closed");
  } catch {
    // The panel still moves. The choice will not survive a reload.
  }
}

export function useMemoryPanel() {
  const mobile = useOverlay();
  const [open, setOpen] = useState(() => panelOpen(readChoice()));
  const [sheetOpen, setSheetOpen] = useState(false);
  const close = useCallback(() => {
    if (mobile) {
      setSheetOpen(false);
      return;
    }
    writeChoice(false);
    setOpen(false);
  }, [mobile]);
  const show = useCallback(() => {
    if (mobile) {
      setSheetOpen(true);
      return;
    }
    writeChoice(true);
    setOpen(true);
  }, [mobile]);
  return { open: panelShown(mobile, open, sheetOpen), mobile, close, show };
}
