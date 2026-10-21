/**
 * `/chat/room/:id` (ADR-0042): several remoras in one chat. `@Name` asks one, `@everyone` asks all;
 * otherwise the room's responder decides: Mentions (only when named), Lead (the lead answers), or
 * Auto (a rule goes to Sentinel, an onchain question to Scout, then a small model picks, then the
 * lead). Each owner line says where it went.
 */
import type { RoomResponder } from "@remora/schema";
import { useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import { useShellTitle } from "@/app/shell";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { api } from "@/features/remoras/api";
import { RequireOwner, useLoad } from "@/features/remoras/hooks";
import { type Line, lineFromRoom } from "./lines";
import { ThreadComposer } from "./thread-composer";
import { ThreadView } from "./thread-view";

const RESPONDER: Record<RoomResponder, string> = {
  auto: "Auto",
  lead: "Lead answers",
  mentions: "Only when @named",
};
const ROUTE: Record<string, string> = {
  mention: "named",
  everyone: "everyone",
  signal: "matched",
  auto: "picked",
  lead: "lead",
};

function RoomChat({ id }: { id: string }) {
  const rooms = useLoad(() => api.rooms(), []);
  const remoras = useLoad(() => api.remoras(), []);
  const [waiting, setWaiting] = useState(false);
  const [pending, setPending] = useState<Line | null>(null);
  const messages = useLoad(() => api.roomMessages(id), [id], waiting ? 2_000 : 6_000);
  const room = rooms.data?.rooms.find((r) => r.id === id);
  useShellTitle(room?.name ?? "Room");
  const all = remoras.data?.remoras ?? [];
  const members = all.filter((r) => room?.memberIds.includes(r.id));
  const name = (rid: string) => all.find((r) => r.id === rid)?.name ?? "someone";
  const lines = (messages.data?.messages ?? []).map(lineFromRoom);
  const shown =
    pending && !lines.some((l) => l.author === "owner" && l.text === pending.text)
      ? [...lines, pending]
      : lines;

  const send = async (text: string) => {
    setPending({
      id: `pending-${Date.now()}`,
      author: "owner",
      remora: null,
      type: null,
      text,
      payload: {},
      eventId: null,
      feedback: null,
      createdAt: new Date().toISOString(),
    });
    setWaiting(true);
    const out = await api.postToRoom(id, text);
    setWaiting(false);
    await messages.refresh();
    setPending(null);
    if (!out.ok) toast.error(out.error);
    else if (!out.data.routedTo.length)
      toast("Nobody was named. @mention a remora, or set the room to Auto.");
  };
  const set = async (b: { responder?: RoomResponder; leadId?: string | null }) => {
    const out = await api.editRoom(id, b);
    if (!out.ok) return void toast.error(out.error);
    void rooms.refresh();
  };
  const routeLabel = (l: Line) =>
    l.author === "owner" && l.route && l.route !== "none" && l.routedTo?.length
      ? `→ ${l.routedTo.map(name).join(", ")} · ${ROUTE[l.route] ?? l.route}`
      : l.author === "owner" && l.route === "none"
        ? "→ nobody (no @mention)"
        : null;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-6 lg:px-10">
        <h1 className="text-base font-semibold"># {room?.name ?? "…"}</h1>
        <span className="text-xs text-muted-foreground" data-testid="room-members">
          {members.map((m) => m.name).join(", ") || "no remoras yet"}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
          <NativeSelect
            aria-label="Who answers"
            size="sm"
            value={room?.responder ?? "auto"}
            onChange={(e) => void set({ responder: e.target.value as RoomResponder })}
          >
            {Object.entries(RESPONDER).map(([k, v]) => (
              <NativeSelectOption key={k} value={k}>
                {v}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Lead"
            size="sm"
            value={room?.leadId ?? ""}
            onChange={(e) => void set({ leadId: e.target.value || null })}
          >
            <NativeSelectOption value="">Lead: first member</NativeSelectOption>
            {members.map((m) => (
              <NativeSelectOption key={m.id} value={m.id}>
                Lead: {m.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-10">
        {shown.length === 0 && !messages.loading ? (
          <p className="text-sm text-muted-foreground">
            Talk to the whole team. Name one with @, like “@Sentinel ignore incoming SUI under
            0.01”, or just ask, and the right one answers.
          </p>
        ) : null}
        <ThreadView
          lines={shown}
          waiting={waiting}
          waitingFor="The team"
          showNames
          routeLabel={routeLabel}
          onChanged={() => void messages.refresh()}
        />
      </div>
      <div className="px-4 pb-4 sm:px-6 lg:px-10">
        <ThreadComposer
          placeholder={`Message #${room?.name ?? "room"}… (@ to name a remora)`}
          disabled={waiting || !members.length}
          mentions={[...members.map((m) => m.name), "everyone"]}
          onSend={(t) => void send(t)}
        />
      </div>
    </div>
  );
}

export function RoomPage() {
  const { id = "" } = useParams();
  return (
    <RequireOwner what="this room" needsWallet>
      {() => <RoomChat id={id} />}
    </RequireOwner>
  );
}
