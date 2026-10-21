/**
 * The sidebar's Remoras and Rooms (ADR-0042): your remoras as contacts (open a 1-1 chat) and the rooms
 * they share. Shown once the session has a wallet; collapsed sidebars keep only the icons above.
 */
import { Egg, Hash, Plus } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { api } from "@/features/remoras/api";
import { useLoad, useOwner } from "@/features/remoras/hooks";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = {
  active: "bg-emerald-500",
  shadow: "bg-amber-500",
  paused: "bg-muted-foreground",
  creating: "bg-sky-500",
};

export function SidebarTeam({ onNavigate }: { onNavigate: () => void }) {
  const { owner } = useOwner();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const none = { ok: true as const, data: { remoras: [] as never[] } };
  const remoras = useLoad(() => (owner ? api.remoras() : Promise.resolve(none)), [owner], 60_000);
  const rooms = useLoad(
    () =>
      owner ? api.rooms() : Promise.resolve({ ok: true as const, data: { rooms: [] as never[] } }),
    [owner],
    60_000,
  );
  if (!owner) return null;
  const live = (remoras.data?.remoras ?? []).filter((r) => r.status !== "retired");
  const newRoom = async () => {
    const out = await api.createRoom({
      name: "New room",
      memberIds: live.map((r) => r.id),
      responder: "auto",
    });
    if (!out.ok) return void toast.error(out.error);
    void rooms.refresh();
    onNavigate();
    navigate(`/chat/room/${out.data.room.id}`);
  };
  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Remoras</SidebarGroupLabel>
        <SidebarGroupAction asChild title="New remora">
          <Link to="/remoras/new" aria-label="New remora" onClick={onNavigate}>
            <Plus />
          </Link>
        </SidebarGroupAction>
        <SidebarGroupContent>
          <SidebarMenu aria-label="Remora contacts">
            {live.map((r) => (
              <SidebarMenuItem key={r.id}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === `/chat/r/${r.id}`}
                  tooltip={r.name}
                >
                  <Link to={`/chat/r/${r.id}`} onClick={onNavigate}>
                    <span className="relative flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                      {r.name.slice(0, 1).toUpperCase()}
                      <span
                        aria-hidden
                        className={cn(
                          "absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full",
                          DOT[r.status] ?? "bg-muted",
                        )}
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith("/hatchery")}
                tooltip="Hatchery"
              >
                <Link to="/hatchery" onClick={onNavigate}>
                  <Egg />
                  <span>Hatchery</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {remoras.data && !live.length ? (
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/remoras/import" onClick={onNavigate}>
                    <span className="text-muted-foreground">Import a team…</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : null}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Rooms</SidebarGroupLabel>
        <SidebarGroupAction title="New room" aria-label="New room" onClick={() => void newRoom()}>
          <Plus />
        </SidebarGroupAction>
        <SidebarGroupContent>
          <SidebarMenu aria-label="Rooms">
            {(rooms.data?.rooms ?? []).map((room) => (
              <SidebarMenuItem key={room.id}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === `/chat/room/${room.id}`}
                  tooltip={room.name}
                >
                  <Link to={`/chat/room/${room.id}`} onClick={onNavigate}>
                    <Hash />
                    <span className="min-w-0 flex-1 truncate">{room.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
