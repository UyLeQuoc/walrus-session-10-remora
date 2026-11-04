/**
 * ADR-0130 (F13): memory capsules. Lend a few of this remora's memories to another owner's remora,
 * Seal-encrypted on Walrus, until a date or until you take them back (one signature each). A remora
 * that was offered a capsule reads it only after its owner accepts, and only while it isn't revoked.
 */
import type { RemoraView } from "@remora/schema";
import { Gift, KeyRound, Lock, Search, Undo2 } from "lucide-react";
import { useState } from "react";
import { Section } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Problem } from "@/components/visual";
import { useSignAndRun } from "@/features/funds/sign";
import { api } from "./api";
import { useLoad } from "./hooks";

const until = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function CapsuleCard({ r, onChanged }: { r: RemoraView; onChanged?: () => void }) {
  const view = useLoad(() => api.capsules(r.id), [r.id]);
  const run = useSignAndRun();
  const [q, setQ] = useState("sources");
  const [found, setFound] = useState<{ blobId: string; namespace: string; text: string }[] | null>(
    null,
  );
  const [picked, setPicked] = useState<string[]>([]);
  const [to, setTo] = useState("");
  const [days, setDays] = useState("7");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  if (view.error) return <Problem title="Can't load its capsules." detail={view.error} />;
  const v = view.data;
  const readOnly = r.status === "retired";

  const step = async (key: string, work: () => Promise<void>) => {
    setBusy(key);
    setError("");
    try {
      await work();
      void view.refresh();
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const search = () =>
    step("search", async () => {
      const out = await api.lendable(r.id, q);
      if (!out.ok) throw new Error(out.error);
      setFound(out.data.memories);
      setPicked([]);
    });

  const lend = () =>
    step("lend", async () => {
      const tx = await api.lendTx(r.id, { query: q, blobIds: picked, to, days: Number(days) });
      if (!tx.ok) throw new Error(tx.error);
      const digest = await run(tx.data.transaction);
      const done = await api.lendConfirm(r.id, digest, tx.data.draft);
      if (!done.ok) throw new Error(done.error);
      setFound(null);
      setPicked([]);
    });

  const revoke = (capsuleId: string) =>
    step(`revoke${capsuleId}`, async () => {
      const tx = await api.revokeCapsuleTx(r.id, capsuleId);
      if (!tx.ok || !tx.data.transaction) throw new Error(tx.ok ? "Nothing to sign." : tx.error);
      const digest = await run(tx.data.transaction);
      const done = await api.revokeCapsuleConfirm(r.id, capsuleId, digest);
      if (!done.ok) throw new Error(done.error);
    });

  const accept = (capsuleId: string) =>
    step(`accept${capsuleId}`, async () => {
      const out = await api.acceptCapsule(r.id, capsuleId);
      if (!out.ok) throw new Error(out.error);
    });

  return (
    <Section
      title="Lend its memories"
      hint="A few memories, Seal-encrypted on Walrus, for another owner's remora. Only that remora can read them, only until the date, and only until you take them back."
    >
      <div className="flex flex-col gap-4" data-testid="capsule-card">
        {v?.offered.map((o) => (
          <div
            key={o.capsuleId}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-ob-accent/40 bg-ob-accent/5 p-3 text-md"
            data-testid="capsule-offered"
          >
            <Gift className="size-4 text-ob-accent" aria-hidden />
            <span>
              Offered: <b>{o.count} memories</b> from {o.from.remora} until {until(o.expiresMs)}
            </span>
            {readOnly ? null : (
              <Button
                type="button"
                size="sm"
                className="ml-auto"
                disabled={busy !== ""}
                data-testid="capsule-accept"
                onClick={() => void accept(o.capsuleId)}
              >
                {busy === `accept${o.capsuleId}` ? <Spinner /> : null} Accept
              </Button>
            )}
          </div>
        ))}
        {v?.reading.length ? (
          <ul className="flex flex-col gap-1 text-sm" aria-label="Memories it reads">
            {v.reading.map((c) => (
              <li key={c.id} className="flex items-center gap-2" data-testid="capsule-reading">
                <KeyRound className="size-3.5 text-ob-muted" aria-hidden /> Reads {c.count} memories
                from {c.from.remora} until {until(c.expiresMs)}
              </li>
            ))}
          </ul>
        ) : null}
        {v?.lent.length ? (
          <ul className="flex flex-col gap-1 text-sm" aria-label="Memories it lent">
            {v.lent.map((c) => (
              <li
                key={c.capsuleId}
                className="flex flex-wrap items-center gap-2"
                data-testid="capsule-lent"
              >
                <Lock className="size-3.5 text-ob-muted" aria-hidden />
                {c.count} memories to <b>{c.to}</b> until {until(c.expiresMs)}
                {c.revoked ? (
                  <Badge variant="outline">taken back</Badge>
                ) : readOnly ? null : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy !== ""}
                    data-testid="capsule-revoke"
                    onClick={() => void revoke(c.capsuleId)}
                  >
                    {busy === `revoke${c.capsuleId}` ? (
                      <Spinner />
                    ) : (
                      <Undo2 className="size-4" aria-hidden />
                    )}{" "}
                    Take back · one signature
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {readOnly ? null : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Input
                aria-label="Find memories to lend"
                className="min-w-0 flex-1"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={busy !== ""}
                data-testid="capsule-search"
                onClick={() => void search()}
              >
                {busy === "search" ? <Spinner /> : <Search className="size-4" aria-hidden />} Find
              </Button>
            </div>
            {found ? (
              found.length ? (
                <ul className="flex flex-col gap-1.5" aria-label="Memories you can lend">
                  {found.map((m) => (
                    <li key={m.blobId} className="flex items-start gap-2 text-sm">
                      <Checkbox
                        aria-label={`Lend: ${m.text.slice(0, 60)}`}
                        data-testid="capsule-pick"
                        checked={picked.includes(m.blobId)}
                        onCheckedChange={(on) =>
                          setPicked((p) =>
                            on ? [...p, m.blobId] : p.filter((x) => x !== m.blobId),
                          )
                        }
                      />
                      <span className="[overflow-wrap:anywhere]" data-ux-skip>
                        <span className="text-ob-muted">{m.namespace}</span> ·{" "}
                        {m.text.slice(0, 200)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ob-secondary">Nothing found; try other words.</p>
              )
            ) : null}
            {picked.length ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_6rem_auto]">
                <Input
                  aria-label="Lend to (a remora's @name or address)"
                  placeholder="@their-remora or 0x…"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
                <Input
                  aria-label="For how many days"
                  inputMode="numeric"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
                <Button
                  type="button"
                  disabled={busy !== "" || !to.trim()}
                  data-testid="capsule-lend"
                  onClick={() => void lend()}
                >
                  {busy === "lend" ? <Spinner /> : null} Lend {picked.length} · one signature
                </Button>
              </div>
            ) : null}
          </div>
        )}
        {error ? <p className="text-md text-ob-danger-text">{error}</p> : null}
      </div>
    </Section>
  );
}
