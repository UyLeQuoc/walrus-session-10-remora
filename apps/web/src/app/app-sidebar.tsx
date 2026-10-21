/**
 * B4: five navigation items, Recents, a compact setup card while setup is unfinished, and the
 * account menu. Get started, Verify, Settings, the guide and the channel card moved into the menu.
 */
import { Brain, Fish, Inbox, Search, SquarePen, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { navActive } from "@/app/nav-active";
import { AccountMenu } from "@/components/app/account-menu";
import { SetupChecklist } from "@/components/app/setup-checklist";
import { Logo } from "@/components/logo";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { filterConversations } from "@/features/chat/conversations-filter";
import { useConversations } from "@/features/chat/use-conversations";
import { api } from "@/features/remoras/api";
import { useLoad, useOwner } from "@/features/remoras/hooks";
import { SidebarTeam } from "@/features/threads/sidebar-team";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const NAV = [
  { to: "/", label: "Home", icon: Fish },
  { to: "/approvals", label: "Approvals", icon: Inbox },
  { to: "/funds", label: "Funds", icon: Wallet },
  { to: "/memory", label: "Memory", icon: Brain },
] as const;

export function AppSidebar({
  onNewChat,
  onOpenChat,
  activeChatId,
}: {
  onNewChat: () => void;
  onOpenChat: (id: string) => void;
  activeChatId: string | null;
}) {
  const { state, setOpenMobile } = useSidebar();
  const closeOnPhone = () => setOpenMobile(false);
  const { pathname } = useLocation();
  const collapsed = state === "collapsed";
  const { items, remove } = useConversations();
  const [text, setText] = useState("");
  const query = useDebouncedValue(text);
  const shown = filterConversations(items, query);
  const { owner } = useOwner();
  const inbox = useLoad(
    () =>
      owner
        ? api.approvals()
        : Promise.resolve({ ok: true as const, data: { approvals: [] as never[] } }),
    [owner],
    30_000,
  );
  const pending = inbox.data?.approvals.length ?? 0;

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <Link to="/" className="flex items-center rounded-md px-2 py-1.5" onClick={closeOnPhone}>
          <Logo size={collapsed ? 24 : 28} tone="primary" background withText={!collapsed} />
        </Link>
      </SidebarHeader>
      <SidebarContent className="overflow-hidden">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  onClick={() => {
                    closeOnPhone();
                    onNewChat();
                  }}
                >
                  <SquarePen />
                  <span>New chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {NAV.map(({ to, label, icon: Icon }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton asChild isActive={navActive(to, pathname)} tooltip={label}>
                    <Link to={to} onClick={closeOnPhone}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                  {to === "/approvals" && pending > 0 ? (
                    <SidebarMenuBadge>{pending}</SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {!collapsed ? <SidebarTeam onNavigate={closeOnPhone} /> : null}
        {!collapsed && items.length > 0 && (
          <SidebarGroup className="min-h-0 flex-1">
            <SidebarGroupLabel>Recents</SidebarGroupLabel>
            <SidebarGroupContent className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 pb-2">
                <InputGroup>
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={text}
                    aria-label="Search chats"
                    placeholder="Search chats"
                    onChange={(event) => setText(event.target.value)}
                  />
                </InputGroup>
              </div>
              <ScrollArea
                className="min-h-0 flex-1"
                viewportClassName="scroll-fade-y [&>div]:block! [&>div]:min-w-0"
              >
                {shown.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">No chats</p>
                ) : (
                  <SidebarMenu className="pb-2">
                    {shown.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          type="button"
                          isActive={item.id === activeChatId}
                          onClick={() => {
                            closeOnPhone();
                            onOpenChat(item.id);
                          }}
                        >
                          <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        </SidebarMenuButton>
                        <SidebarMenuAction
                          aria-label={`Delete ${item.title}`}
                          showOnHover
                          onClick={() => {
                            void remove(item.id).then((ok) => {
                              if (ok && item.id === activeChatId) onNewChat();
                            });
                          }}
                        >
                          <Trash2 />
                        </SidebarMenuAction>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                )}
              </ScrollArea>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="gap-2">
        <SetupChecklist variant="compact" />
        <AccountMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
