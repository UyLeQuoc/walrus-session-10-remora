import type { CSSProperties } from "react";
import { Outlet, useNavigate } from "react-router";
import { AppSidebar } from "@/app/app-sidebar";
import { ShellContext, useShellState } from "@/app/shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { clearActiveChat, writeActiveChat } from "@/features/chat/active-chat";

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
    navigate("/");
  };

  const requestOpenChat = (id: string) => {
    writeActiveChat(id);
    setActiveChatId(id);
    setOpenTick((n) => n + 1);
    navigate("/");
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
            <div className="flex w-full items-center gap-2 px-2">
              <SidebarTrigger />
              <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{title}</p>
              <ThemeToggle />
            </div>
          </header>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </ShellContext.Provider>
  );
}
