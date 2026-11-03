/**
 * The roster's Remoras and Rooms (ADR-0042, ADR-0069): your remoras as contacts (open a 1-1 chat)
 * and the rooms they share, as openbot's agent rows. Signed out, the one thing to try without a
 * wallet (H7, ADR-0051).
 */
import type { Room } from "@remora/schema";
import { Fish, Plus, Upload } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { RemoraAvatar, remoraMood } from "@/components/app/remora-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/features/remoras/api";
import { describeRemora, useTemplateCatalog } from "@/features/remoras/describe";
import { useLoad, useOwner } from "@/features/remoras/hooks";
import { kindName } from "@/lib/kind";
import {
  AgentRow,
  AgentRowItem,
  AgentStatusDot,
  ChannelAvatar,
  SidebarIconButton,
  SidebarSection,
} from "@/openbot";

type RemoraRow = {
  id: string;
  name: string;
  template: string;
  status: string;
  updatedAt: string;
  config: { persona: string };
};

const TONE: Record<string, "success" | "warning" | "accent" | "muted"> = {
  active: "success",
  shadow: "warning",
  paused: "muted",
  creating: "accent",
};

const STATE: Record<string, string> = {
  active: "live",
  shadow: "in practice mode",
  paused: "paused",
  creating: "being created",
};

/** "14:05" today, "Oct 25" before. */
export function rosterTime(iso: string, now = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return at.toDateString() === now.toDateString()
    ? at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : at.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SidebarTeam({
  onNavigate,
  query = "",
  waiting = [],
}: {
  onNavigate: () => void;
  query?: string;
  /** The remoras with approvals waiting, so their faces ask for you too. */
  waiting?: ReadonlyArray<{ id: string; count: number }>;
}) {
  const { owner } = useOwner();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const none = { ok: true as const, data: { remoras: [] as never[] } };
  const remoras = useLoad(() => (owner ? api.remoras() : Promise.resolve(none)), [owner], 60_000);
  const rooms = useLoad(
    () =>
      owner ? api.rooms() : Promise.resolve({ ok: true as const, data: { rooms: [] as Room[] } }),
    [owner],
    60_000,
  );
  const catalog = useTemplateCatalog();
  const waits = new Map(waiting.map((w) => [w.id, w.count]));
  if (!owner)
    return (
      <SidebarSection name="Try Remora" listLabel="Try Remora">
        <AgentRowItem>
          <AgentRow
            to="/playground"
            onClick={onNavigate}
            active={pathname === "/playground"}
            avatar={
              <span className="grid size-9 place-items-center rounded-full bg-ob-control-hover text-ob-muted">
                <Fish aria-hidden className="size-4" />
              </span>
            }
            name="Try a Researcher"
            badge="no wallet"
            preview="Ask one paid question on testnet"
            label="Try a Researcher, no wallet"
          />
        </AgentRowItem>
      </SidebarSection>
    );

  const q = query.trim().toLowerCase();
  const all = (remoras.data?.remoras ?? []) as RemoraRow[];
  const live = all.filter((r) => r.status !== "retired");
  const byId = new Map(live.map((r) => [r.id, r]));
  const shown = q ? live.filter((r) => r.name.toLowerCase().includes(q)) : live;
  const roomList = (rooms.data?.rooms ?? []).filter((room) =>
    q ? room.name.toLowerCase().includes(q) : true,
  );
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
      <SidebarSection
        name="Remoras"
        listLabel="Remora contacts"
        storageKey="remora.roster.remoras"
        action={
          <SidebarIconButton label="New remora" onClick={() => navigate("/remoras/new")}>
            <Plus aria-hidden />
          </SidebarIconButton>
        }
      >
        {/* ADR-0103: while the list is unknown it shows its shape, never an empty account. */}
        {!remoras.data && !remoras.error
          ? [0, 1, 2, 3, 4].map((i) => (
              <li key={`skeleton-${i}`} className="flex items-center gap-2.5 px-2 py-2" aria-hidden>
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-36" />
                </span>
              </li>
            ))
          : null}
        {!remoras.data && remoras.error ? (
          <li className="flex items-center justify-between gap-2 px-2 py-2 text-xs text-ob-muted">
            Can't load your remoras.
            <button type="button" className="link text-xs" onClick={() => void remoras.refresh()}>
              Retry
            </button>
          </li>
        ) : null}
        {shown.map((r) => (
          <AgentRowItem key={r.id}>
            <AgentRow
              to={`/chat/r/${r.id}`}
              onClick={onNavigate}
              active={pathname === `/chat/r/${r.id}`}
              avatar={<RemoraAvatar id={r.id} mood={remoraMood(r, waits.get(r.id))} />}
              status={<AgentStatusDot tone={TONE[r.status] ?? "muted"} />}
              name={r.name}
              time={rosterTime(r.updatedAt)}
              preview={describeRemora(r, catalog)}
              label={`${r.name}, ${kindName(r.template)}, ${STATE[r.status] ?? r.status}`}
            />
          </AgentRowItem>
        ))}
        {remoras.data && !live.length ? (
          <AgentRowItem>
            <AgentRow
              to="/remoras/import"
              onClick={onNavigate}
              size="compact"
              avatar={<Upload aria-hidden />}
              name="Import a team…"
            />
          </AgentRowItem>
        ) : null}
        {q && !shown.length && live.length ? <li className="empty-search">No remoras</li> : null}
      </SidebarSection>
      <SidebarSection
        name="Rooms"
        listLabel="Rooms"
        storageKey="remora.roster.rooms"
        action={
          <SidebarIconButton label="New room" onClick={() => void newRoom()}>
            <Plus aria-hidden />
          </SidebarIconButton>
        }
      >
        {roomList.map((room) => {
          const members = room.memberIds
            .map((id) => byId.get(id))
            .filter((r): r is RemoraRow => Boolean(r));
          return (
            <AgentRowItem key={room.id}>
              <AgentRow
                to={`/chat/room/${room.id}`}
                onClick={onNavigate}
                active={pathname === `/chat/room/${room.id}`}
                avatar={
                  <ChannelAvatar>
                    {members.slice(0, 4).map((m) => (
                      <RemoraAvatar
                        key={m.id}
                        id={m.id}
                        mood={remoraMood(m)}
                        size={members.length === 1 ? 36 : 17}
                        still
                      />
                    ))}
                  </ChannelAvatar>
                }
                name={room.name}
                preview={members.map((m) => m.name).join(", ") || "No members yet"}
                label={`${room.name}, room`}
              />
            </AgentRowItem>
          );
        })}
      </SidebarSection>
    </>
  );
}
