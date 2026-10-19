import { useCallback, useEffect, useState } from "react";
import {
  type PanelChoice,
  panelOpen,
  panelShown,
  parsePanelChoice,
} from "@/features/chat/memory-panel-state";
import { readStored, writeStored } from "@/lib/storage";

const KEY = "remora.memory-panel";
const OLD_KEY = "hippo.memory-panel";
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
  return parsePanelChoice(readStored("local", KEY, OLD_KEY));
}

function writeChoice(open: boolean): void {
  writeStored("local", KEY, open ? "open" : "closed");
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
