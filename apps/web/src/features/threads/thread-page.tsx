/**
 * `/chat/r/:id` (ADR-0042): chat with one remora like a contact. Scout buys and answers in the
 * thread; Sentinel learns rules from what you say. Payments, blocks and learned rules show as chips,
 * approvals as cards you can act on, and every answer has Why?, 👍 and 👎. The header picks its model.
 */
import { useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { useShellTitle } from "@/app/shell";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { ModelPicker } from "@/features/chat/model-picker";
import { DEFAULT_MODEL_ID, modelById } from "@/features/chat/models";
import { api } from "@/features/remoras/api";
import { RequireOwner, useLoad } from "@/features/remoras/hooks";
import { type Line, lineFromFeed } from "./lines";
import { ThreadComposer } from "./thread-composer";
import { ThreadView } from "./thread-view";

function Thread({ id }: { id: string }) {
  const remora = useLoad(() => api.remora(id), [id]);
  const [waiting, setWaiting] = useState(false);
  const [pending, setPending] = useState<Line | null>(null);
  const feed = useLoad(
    () => api.feed({ remora: id, order: "asc", limit: "200" }),
    [id],
    waiting ? 2_000 : 8_000,
  );
  const r = remora.data?.remora;
  useShellTitle(r?.name ?? "Chat");
  const lines = (feed.data?.events ?? []).map(lineFromFeed);
  const shown =
    pending && !lines.some((l) => l.author === "owner" && l.text === pending.text)
      ? [...lines, pending]
      : lines;

  const send = async (text: string) => {
    setPending({
      id: `pending-${Date.now()}`,
      author: "owner",
      remora: null,
      type: "message",
      text,
      payload: {},
      eventId: null,
      feedback: null,
      createdAt: new Date().toISOString(),
    });
    setWaiting(true);
    const out = await api.message(id, text);
    setWaiting(false);
    await feed.refresh();
    setPending(null);
    if (!out.ok) toast.error(out.error);
  };
  const choose = async (model: string) => {
    const out = await api.edit(id, { model: model || null });
    if (!out.ok) return void toast.error(out.error);
    toast.success(
      model
        ? `${r?.name} now thinks with ${modelById(model).label}.`
        : "Back to the default model.",
    );
    void remora.refresh();
  };

  if (remora.error) return <p className="p-6 text-sm text-destructive">{remora.error}</p>;
  const live = r?.status === "active" || r?.status === "shadow";
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-6 lg:px-10">
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
        >
          {r?.name.slice(0, 1).toUpperCase() ?? "·"}
        </span>
        <h1 className="text-base font-semibold">{r?.name ?? "…"}</h1>
        {r ? <StatusBadge status={r.status} /> : null}
        <span className="text-xs text-muted-foreground">{r?.template}</span>
        <div className="ml-auto flex items-center gap-1">
          {r ? (
            <span data-testid="thread-model">
              <ModelPicker
                value={r.config.model ?? DEFAULT_MODEL_ID}
                onChange={(m) => void choose(m)}
              />
            </span>
          ) : null}
          <Button asChild variant="ghost" size="sm">
            <Link to={`/remoras/${id}`}>Details</Link>
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-10">
        {shown.length === 0 && !feed.loading ? (
          <p className="text-sm text-muted-foreground">
            {r?.template === "sentinel"
              ? 'Tell it what matters, like "ignore incoming SUI under 0.01", or ask what it watches.'
              : "Ask it anything onchain. It buys data when that helps and tells you what it cost."}
          </p>
        ) : null}
        <ThreadView
          lines={shown}
          waiting={waiting}
          waitingFor={r?.name}
          onChanged={() => void feed.refresh()}
        />
      </div>
      <div className="px-4 pb-4 sm:px-6 lg:px-10">
        <ThreadComposer
          placeholder={
            live
              ? `Message ${r?.name ?? "your remora"}…`
              : `${r?.name ?? "This remora"} is ${r?.status ?? "loading"}.`
          }
          disabled={!live || waiting}
          onSend={(t) => void send(t)}
        />
      </div>
    </div>
  );
}

export function ThreadPage() {
  const { id = "" } = useParams();
  return (
    <RequireOwner what="this chat" needsWallet>
      {() => <Thread id={id} />}
    </RequireOwner>
  );
}
