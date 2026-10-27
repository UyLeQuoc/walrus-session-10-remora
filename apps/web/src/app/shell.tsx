import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { readActiveChat } from "@/features/chat/active-chat";
import type { MobilePane, SidePanelTab } from "@/openbot";

/** What a page asks the shell's side panel to show; the content itself is portalled in. */
export type SidePanelMeta = {
  owner: string;
  title: string;
  tabs?: SidePanelTab[];
  activeTab?: string;
  onTab?: (id: string) => void;
  onClose: () => void;
};

type Shell = {
  title: string;
  setTitle: (title: string) => void;
  newChatTick: number;
  requestNewChat: () => void;
  activeChatId: string | null;
  openTick: number;
  requestOpenChat: (id: string) => void;
  adoptChat: (id: string) => void;
  /** The phone's visible pane (ADR-0069: one pane at a time at 720px and below). */
  mobilePane?: MobilePane;
  setMobilePane?: (pane: MobilePane) => void;
  /** The side panel's body, and the page that owns it. */
  sidePanelNode?: HTMLElement | null;
  sidePanel?: SidePanelMeta | null;
  setSidePanel?: Dispatch<SetStateAction<SidePanelMeta | null>>;
  /** The top row's slots a page may fill: its heading group and extra controls. */
  headerStartNode?: HTMLElement | null;
  headerEndNode?: HTMLElement | null;
  headerClaims?: number;
  claimHeader?: (delta: number) => void;
};

export const ShellContext = createContext<Shell | null>(null);

export function useShellTitle(title: string) {
  const shell = useContext(ShellContext);
  useEffect(() => {
    shell?.setTitle(title);
  }, [shell, title]);
}

export function useNewChatTick(): number {
  return useContext(ShellContext)?.newChatTick ?? 0;
}

export function useOpenTick(): number {
  return useContext(ShellContext)?.openTick ?? 0;
}

export function useActiveChatId(): string | null {
  return useContext(ShellContext)?.activeChatId ?? null;
}

export function useAdoptChat(): (id: string) => void {
  return useContext(ShellContext)?.adoptChat ?? (() => {});
}

export function useShellState() {
  const [title, setTitle] = useState("remora");
  const [newChatTick, setNewChatTick] = useState(0);
  const [activeChatId, setActiveChatId] = useState<string | null>(() => readActiveChat());
  const [openTick, setOpenTick] = useState(0);
  return {
    title,
    setTitle,
    newChatTick,
    setNewChatTick,
    activeChatId,
    setActiveChatId,
    openTick,
    setOpenTick,
  };
}

/**
 * Puts `children` in the shell's docked side panel while `open`. Outside the app shell (a test that
 * mounts a page alone) it renders nothing.
 */
export function ShellSidePanel({
  open,
  title,
  tabs,
  activeTab,
  onTab,
  onClose,
  children,
}: Omit<SidePanelMeta, "owner"> & { open: boolean; children: ReactNode }) {
  const shell = useContext(ShellContext);
  const owner = useId();
  const setSidePanel = shell?.setSidePanel;
  // The shell keeps stable handlers that call the latest ones, so a re-render here does not
  // re-register the panel (which would re-render the shell, and this page, again).
  const handlers = useRef({ onClose, onTab });
  handlers.current = { onClose, onTab };
  const stable = useMemo(
    () => ({
      onClose: () => handlers.current.onClose(),
      onTab: (id: string) => handlers.current.onTab?.(id),
    }),
    [],
  );
  const tabsKey = JSON.stringify(tabs ?? []);
  useLayoutEffect(() => {
    if (!setSidePanel) return;
    if (open)
      setSidePanel({
        owner,
        title,
        tabs: JSON.parse(tabsKey) as SidePanelTab[],
        activeTab,
        onTab: stable.onTab,
        onClose: stable.onClose,
      });
    else setSidePanel((current) => (current?.owner === owner ? null : current));
  }, [setSidePanel, open, owner, title, tabsKey, activeTab, stable]);
  useEffect(
    () => () => setSidePanel?.((current) => (current?.owner === owner ? null : current)),
    [setSidePanel, owner],
  );
  const node = shell?.sidePanelNode;
  if (!open || !node || shell?.sidePanel?.owner !== owner) return null;
  return createPortal(children, node);
}

/** Whether a shell side panel exists here (a page alone in a test has none). */
export function useHasSidePanel(): boolean {
  return Boolean(useContext(ShellContext)?.setSidePanel);
}

/** Replaces the top row's title with a page's own heading group (an avatar, a name, a picker). */
export function ShellHeaderStart({ children }: { children: ReactNode }) {
  const shell = useContext(ShellContext);
  const claim = shell?.claimHeader;
  useLayoutEffect(() => {
    claim?.(1);
    return () => claim?.(-1);
  }, [claim]);
  const node = shell?.headerStartNode;
  return node ? createPortal(children, node) : null;
}

/** Adds a page's controls to the end of the top row, before the network and panic controls. */
export function ShellHeaderEnd({ children }: { children: ReactNode }) {
  const node = useContext(ShellContext)?.headerEndNode;
  return node ? createPortal(children, node) : null;
}
