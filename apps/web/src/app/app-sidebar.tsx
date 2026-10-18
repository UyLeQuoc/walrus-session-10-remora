import {
  BookOpen,
  Library,
  MessagesSquare,
  Search,
  Send,
  SquarePen,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { WalletAccount } from "@/app/wallet-account";
import { ChannelsCard } from "@/components/channel-links";
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
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { filterConversations } from "@/features/chat/conversations-filter";
import { useConversations } from "@/features/chat/use-conversations";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { DISCORD_BOT, TELEGRAM_BOT } from "@/lib/channels";

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

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <Link to="/" className="flex items-center rounded-md px-2 py-1.5" onClick={closeOnPhone}>
          <Logo variant={collapsed ? "mark" : "lockup"} wordSize={18} />
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
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/me"}>
                  <Link to="/me" onClick={closeOnPhone}>
                    <Library />
                    <span>My memory</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/team"}>
                  <Link to="/team" onClick={closeOnPhone}>
                    <Users />
                    <span>Team</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/guide"}>
                  <Link to="/guide" onClick={closeOnPhone}>
                    <BookOpen />
                    <span>How it works</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {!collapsed && items.length > 0 && (
          <SidebarGroup className="min-h-0 flex-1">
            <SidebarGroupLabel>Chats</SidebarGroupLabel>
            <SidebarGroupContent className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 px-2 pb-2">
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
                  <SidebarMenu className="pe-3 pb-2">
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
                          <span>{item.title}</span>
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
      <SidebarFooter>
        <ChannelsCard />
        <SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Open in Telegram">
              <a href={TELEGRAM_BOT.url} target="_blank" rel="noreferrer">
                <Send />
                <span>Open in Telegram</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Add to Discord">
              <a href={DISCORD_BOT.url} target="_blank" rel="noreferrer">
                <MessagesSquare />
                <span>Add to Discord</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <WalletAccount />
      </SidebarFooter>
    </Sidebar>
  );
}
