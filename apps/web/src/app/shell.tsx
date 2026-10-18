import { createContext, useContext, useEffect, useState } from "react";
import { readActiveChat } from "@/features/chat/active-chat";

type Shell = {
  title: string;
  setTitle: (title: string) => void;
  newChatTick: number;
  requestNewChat: () => void;
  activeChatId: string | null;
  openTick: number;
  requestOpenChat: (id: string) => void;
  adoptChat: (id: string) => void;
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
  const [title, setTitle] = useState("hippo");
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
