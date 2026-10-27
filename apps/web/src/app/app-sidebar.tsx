/**
 * The roster (ADR-0069, openbot's sidebar): the network and the panic control in its top row, one
 * search for chats, remoras and rooms, then "Needs you", Remoras, Rooms and Chats, and the account at
 * the foot. Compact (88px) keeps only the faces.
 */
import type { ApprovalRequest } from "@remora/schema";
import { Inbox, MessageSquare, SquarePen, Trash2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router";
import { AccountMenu } from "@/components/app/account-menu";
import { NetworkSelect } from "@/components/app/network-select";
import { RemoraAvatar } from "@/components/app/remora-avatar";
import { SetupChecklist } from "@/components/app/setup-checklist";
import { filterConversations } from "@/features/chat/conversations-filter";
import { useConversations } from "@/features/chat/use-conversations";
import { PanicButton } from "@/features/funds/panic-button";
import { useOwner } from "@/features/remoras/hooks";
import { rosterTime, SidebarTeam } from "@/features/threads/sidebar-team";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import {
  AgentRow,
  AgentRowAction,
  AgentRowItem,
  AgentStatusWaiting,
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarIconButton,
  SidebarSearch,
  SidebarSection,
  SidebarTopbar,
  SidebarTopbarActions,
  SidebarWaitingGroup,
} from "@/openbot";

export const ROSTER_ID = "remora-roster";

/** The remoras that wait for the owner, one row each, with how many approvals they hold. */
function waiting(approvals: ApprovalRequest[]): Array<{ remora: string; count: number }> {
  const counts = new Map<string, number>();
  for (const a of approvals) counts.set(a.remora, (counts.get(a.remora) ?? 0) + 1);
  return [...counts].map(([remora, count]) => ({ remora, count }));
}

export function AppSidebar({
  compact,
  onExpand,
  networkHere,
  approvals,
  onNewChat,
  onOpenChat,
  onNavigate,
  activeChatId,
}: {
  compact: boolean;
  onExpand: () => void;
  /** Whether the network and panic controls sit here (else the main pane's top row has them). */
  networkHere: boolean;
  approvals: ApprovalRequest[];
  onNewChat: () => void;
  onOpenChat: (id: string) => void;
  onNavigate: () => void;
  activeChatId: string | null;
}) {
  const { pathname } = useLocation();
  const { owner } = useOwner();
  const { items, remove } = useConversations();
  const [text, setText] = useState("");
  const query = useDebouncedValue(text);
  const chats = filterConversations(items, query);
  const waits = owner ? waiting(approvals) : [];

  return (
    <Sidebar compact={compact} id={ROSTER_ID} label="Roster">
      <SidebarTopbar>
        {networkHere && !compact ? <NetworkSelect /> : null}
        <SidebarTopbarActions>
          {networkHere && !compact ? <PanicButton /> : null}
          <SidebarIconButton label="New chat" onClick={onNewChat}>
            <SquarePen aria-hidden />
          </SidebarIconButton>
        </SidebarTopbarActions>
      </SidebarTopbar>
      <SidebarSearch
        value={text}
        onChange={setText}
        label="Search chats"
        placeholder="Search"
        onExpand={onExpand}
      />
      <SidebarBody>
        {waits.length ? (
          <SidebarWaitingGroup name="Needs you" count={approvals.length}>
            {waits.map((w) => (
              <AgentRowItem key={w.remora}>
                <AgentRow
                  to="/approvals"
                  onClick={onNavigate}
                  active={pathname === "/approvals"}
                  avatar={<RemoraAvatar id={w.remora} name={w.remora} />}
                  status={
                    <AgentStatusWaiting>
                      <Inbox aria-hidden />
                    </AgentStatusWaiting>
                  }
                  name={w.remora}
                  waitChip={w.count > 1 ? `${w.count} to approve` : "Approve"}
                  preview="Asks you to approve a payment"
                  label={`${w.remora} waits for your approval (${w.count})`}
                />
              </AgentRowItem>
            ))}
          </SidebarWaitingGroup>
        ) : null}
        <SidebarTeam onNavigate={onNavigate} query={query} />
        {items.length > 0 ? (
          <SidebarSection name="Chats" listLabel="Chats" storageKey="remora.roster.chats">
            {chats.length === 0 ? (
              <li className="empty-search">No chats</li>
            ) : (
              chats.map((item) => (
                <AgentRowItem
                  key={item.id}
                  action={
                    <AgentRowAction
                      label={`Delete ${item.title}`}
                      onClick={() => {
                        void remove(item.id).then((ok) => {
                          if (ok && item.id === activeChatId) onNewChat();
                        });
                      }}
                    >
                      <Trash2 aria-hidden />
                    </AgentRowAction>
                  }
                >
                  <AgentRow
                    size="compact"
                    active={item.id === activeChatId && pathname === "/chat"}
                    avatar={<MessageSquare aria-hidden />}
                    name={item.title}
                    time={rosterTime(item.updatedAt)}
                    label={item.title}
                    onClick={() => {
                      onNavigate();
                      onOpenChat(item.id);
                    }}
                  />
                </AgentRowItem>
              ))
            )}
          </SidebarSection>
        ) : null}
      </SidebarBody>
      <SidebarFooter>
        <div data-compact-hidden>
          <SetupChecklist variant="compact" />
        </div>
        {/* AccountMenu hides its address and balance under a collapsed sidebar's data attribute. */}
        <div
          className={cn("group w-full", compact && "flex justify-center")}
          data-collapsible={compact ? "icon" : undefined}
        >
          <AccountMenu />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
