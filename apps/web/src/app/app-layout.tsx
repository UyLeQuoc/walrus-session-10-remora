import type { CSSProperties } from "react";
import { Outlet, useNavigate } from "react-router";
import { AppSidebar } from "@/app/app-sidebar";
import { ShellContext, useShellState } from "@/app/shell";
import { CommandPalette } from "@/components/app/command-palette";
import { NetworkSelect } from "@/components/app/network-select";
import { ThemeSync } from "@/components/app/theme-choice";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { clearActiveChat, writeActiveChat } from "@/features/chat/active-chat";
import { PanicButton } from "@/features/funds/panic-button";

export function AppLayout() {
  const navigate = useNavigate();
  const {
    title,
    setTitle,
    newChatTick,
    setNewChatTick,
    activeChatId,
    setActiveChatId,
    openTick,
    setOpenTick,
  } = useShellState();

  const requestNewChat = () => {
    clearActiveChat();
    setActiveChatId(null);
    setNewChatTick((n) => n + 1);
    navigate("/chat");
  };

  const requestOpenChat = (id: string) => {
    writeActiveChat(id);
    setActiveChatId(id);
    setOpenTick((n) => n + 1);
    navigate("/chat");
  };

  const adoptChat = (id: string) => {
    writeActiveChat(id);
    setActiveChatId(id);
  };

  return (
    <ShellContext.Provider
      value={{
        title,
        setTitle,
        newChatTick,
        requestNewChat,
        activeChatId,
        openTick,
        requestOpenChat,
        adoptChat,
      }}
    >
      <SidebarProvider
        className="h-dvh min-h-0"
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 60)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as CSSProperties
        }
      >
        <AppSidebar
          onNewChat={requestNewChat}
          onOpenChat={requestOpenChat}
          activeChatId={activeChatId}
        />
        <SidebarInset className="min-h-0 overflow-hidden">
          <header className="flex h-(--header-height) shrink-0 items-center border-b">
            <div className="flex w-full items-center gap-1 px-2">
              <SidebarTrigger className="size-8" />
              <p className="min-w-0 flex-1 truncate pl-1 text-sm text-muted-foreground md:hidden">
                {title}
              </p>
              <div className="hidden flex-1 md:block" />
              <NetworkSelect />
              <PanicButton />
            </div>
          </header>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
      <ThemeSync />
      <CommandPalette />
    </ShellContext.Provider>
  );
}
