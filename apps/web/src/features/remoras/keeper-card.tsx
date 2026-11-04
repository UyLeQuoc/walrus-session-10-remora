/**
 * ADR-0129 (C4): a Keeper pays recurring paid feeds every day and remembers what each normally costs.
 * A price 20% or more above that stops it: pay once, accept the new price, or cancel.
 */
import type { ReefService, RemoraView } from "@remora/schema";
import { CalendarClock, Play, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Section } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Problem } from "@/components/visual";
import { useSignAndRun } from "@/features/funds/sign";
import { fetchReefServices } from "@/features/reef/api";
import { payeeName } from "@/lib/payee";
import { usdc } from "@/lib/usdc";
import { api } from "./api";
import { useLoad } from "./hooks";

const price = (u: string) => `${(Number(u) / 1e6).toFixed(3)} USDC`;

export function KeeperCard({ r, onDone }: { r: RemoraView; onDone?: () => void }) {
  const view = useLoad(() => api.subscriptions(r.id), [r.id]);
  const run = useSignAndRun();
  const [reef, setReef] = useState<ReefService[]>([]);
  const [ref, setRef] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [last, setLast] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    void fetchReefServices()
      .then(setReef)
      .catch(() => setReef([]));
  }, []);
  if (view.error) return <Problem title="Can't load its subscriptions." detail={view.error} />;
  const subs = view.data?.subscriptions ?? [];
  const hikes = view.data?.hikes ?? [];
  const readOnly = r.status === "retired";

  const act = async (key: string, run: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(key);
    setError("");
    const out = await run();
    setBusy("");
    if (!out.ok) setError(out.error ?? "Something went wrong.");
    void view.refresh();
    onDone?.();
  };

  return (
    <Section
      title="Subscriptions"
      hint="Every day at 8am it pays these at their usual price. A price 20% or more above it waits for you."
      actions={
        readOnly ? null : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="-mr-3"
            disabled={busy !== "" || !subs.length}
            data-testid="keeper-run"
            onClick={() =>
              void act("run", async () => {
                const out = await api.runKeeper(r.id);
                if (out.ok) setLast(out.data.answer);
                return out;
              })
            }
          >
            {busy === "run" ? <Spinner /> : <Play className="size-4" aria-hidden />} Run now
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4" data-testid="keeper-card">
        {hikes.map((h) => (
          <div
            key={h.approvalId}
            className="flex flex-col gap-2 rounded-lg border border-ob-warning/50 bg-ob-warning/10 p-3"
            data-testid="keeper-hike"
          >
            <p className="flex items-center gap-2 text-md font-medium">
              <TriangleAlert className="size-4 text-ob-warning-text" aria-hidden /> {h.summary}
            </p>
            {readOnly ? null : (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy !== ""}
                  data-testid="keeper-accept"
                  onClick={() =>
                    void act("accept", () =>
                      api.acceptPrice(r.id, h.subscriptionId, h.amount, h.approvalId),
                    )
                  }
                >
                  Accept {price(h.amount)}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy !== ""}
                  onClick={() => void act("once", () => api.approve(h.approvalId))}
                >
                  Pay once
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy !== ""}
                  onClick={() =>
                    void act("cancel", async () => {
                      await api.reject(h.approvalId);
                      return api.unsubscribe(r.id, h.subscriptionId);
                    })
                  }
                >
                  Cancel it
                </Button>
              </div>
            )}
          </div>
        ))}
        <ul className="flex flex-col gap-2" aria-label="Subscriptions">
          {subs.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-2 text-md"
              data-testid="keeper-sub"
            >
              <CalendarClock className="size-4 text-ob-muted" aria-hidden />
              <b>{payeeName(s.ref)}</b>
              <Badge variant="secondary" data-testid="keeper-usual">
                {s.usual ? `usually ${price(s.usual)}` : "no charge yet"}
              </Badge>
              {s.failures ? <Badge variant="outline">{s.failures} failed</Badge> : null}
              {readOnly ? null : (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Cancel ${payeeName(s.ref)}`}
                  disabled={busy !== ""}
                  onClick={() => void act(`rm${s.id}`, () => api.unsubscribe(r.id, s.id))}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              )}
            </li>
          ))}
          {!subs.length ? <li className="text-ob-secondary">No subscriptions yet.</li> : null}
        </ul>
        {last ? (
          <pre
            className="whitespace-pre-wrap rounded-lg bg-ob-surface-2 p-3 text-sm"
            data-testid="keeper-last"
          >
            {last}
          </pre>
        ) : null}
        {readOnly ? null : (
          <div className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
            <select
              aria-label="Service"
              className="h-9 rounded-md border border-input bg-ob-control px-2 text-md"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
            >
              <option value="">Pick a service…</option>
              {reef
                .filter((s) => s.ref)
                .map((s) => (
                  <option key={s.ref} value={s.ref}>
                    {s.name} · {usdc(s.priceUsdc)} USDC
                  </option>
                ))}
            </select>
            <Input
              aria-label="Exact URL to charge"
              placeholder="https://…/price?symbols=SUI (optional for fixed paths)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy !== "" || !ref}
              data-testid="keeper-add"
              onClick={() =>
                void act("add", async () => {
                  // A service it can't pay yet: one signature adds it to its payees first.
                  const payees = (r.config.budget as { payees?: string[] } | null)?.payees ?? [];
                  if (!payees.includes(ref)) {
                    const tx = await api.payeesTx(r.id, [...payees, ref]);
                    if (!tx.ok || !tx.data.transaction)
                      return { ok: false, error: tx.ok ? "Nothing to sign." : tx.error };
                    const digest = await run(tx.data.transaction);
                    const done = await api.payeesConfirm(r.id, digest, [...payees, ref]);
                    if (!done.ok) return done;
                  }
                  const out = await api.subscribe(r.id, ref, url.trim() || undefined);
                  if (out.ok) {
                    setRef("");
                    setUrl("");
                  }
                  return out;
                })
              }
            >
              Subscribe
            </Button>
          </div>
        )}
        {error ? <p className="text-md text-ob-danger-text">{error}</p> : null}
      </div>
    </Section>
  );
}
