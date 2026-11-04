/**
 * ADR-0114: a crew on its members' pages. Who's in it and what each covers, each one's limit and
 * what it spent this month, the crew's total, and two buttons: pause the crew (no transaction), and
 * retire it (one signature revokes every member's Disc).
 */
import type { RemoraView } from "@remora/schema";
import { Crown, Pause, Play, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Section } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Meter, Problem } from "@/components/visual";
import { useSignAndRun } from "@/features/funds/sign";
import { payeeName } from "@/lib/payee";
import { usdc } from "@/lib/usdc";
import { api } from "./api";
import { useLoad } from "./hooks";

export function CrewCard({ r, onChanged }: { r: RemoraView; onChanged: () => void }) {
  const view = useLoad(() => api.crew(r.id), [r.id]);
  const run = useSignAndRun();
  const [busy, setBusy] = useState<"" | "pause" | "retire">("");
  const [error, setError] = useState("");
  if (view.error) return <Problem title="Can't load its crew right now." detail={view.error} />;
  const v = view.data;
  if (!v) return null;
  const live = v.members.filter((m) => m.status !== "retired");
  const paused = live.length > 0 && live.every((m) => m.status === "paused");

  const pause = async () => {
    setBusy("pause");
    setError("");
    const out = await api.pauseCrew(r.id, !paused);
    setBusy("");
    if (!out.ok) return setError(out.error);
    void view.refresh();
    onChanged();
  };
  const retire = async () => {
    setBusy("retire");
    setError("");
    try {
      const tx = await api.retireCrewTx(r.id);
      if (!tx.ok) throw new Error(tx.error);
      if (!tx.data.transaction) throw new Error("No spending limit to revoke.");
      const digest = await run(tx.data.transaction);
      const done = await api.retireCrewConfirm(r.id, digest);
      if (!done.ok) throw new Error(done.error);
      void view.refresh();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <Section
      title={`Crew · ${v.crew.name}`}
      hint="Its lead splits a question's purchases across the members, all at once. Each member pays from its own limit, and the lead's answer lists every receipt."
    >
      <div className="flex flex-col gap-4" data-testid="crew-card">
        <Meter
          value={Number(v.spent)}
          max={Math.max(Number(v.limit), 1)}
          label="The crew's spend this month"
          left={`${usdc(v.spent)} of ${usdc(v.limit)} USDC`}
          right="this month, all members"
          data-testid="crew-meter"
        />
        <ul className="flex flex-col divide-y divide-ob-border" aria-label="Members">
          {v.members.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-2 py-2 text-md"
              data-testid="crew-member"
            >
              {m.lead ? (
                <Crown className="size-4 text-ob-warning-text" aria-label="lead" />
              ) : (
                <Users className="size-4 text-ob-muted" aria-hidden />
              )}
              <Link className="font-medium hover:underline" to={`/remoras/${m.id}`}>
                {m.name}
              </Link>
              {m.covers.length ? (
                <span className="text-ob-muted">
                  buys {m.covers.map((c) => payeeName(`reef:${c}`)).join(", ")}
                </span>
              ) : m.lead ? (
                <span className="text-ob-muted">hands out, never pays</span>
              ) : null}
              <Badge variant="secondary" className="ml-auto">
                {m.status}
              </Badge>
              <span className="tabular-nums text-ob-secondary">
                {usdc(m.spent)}
                {m.limit ? ` / ${usdc(m.limit)}` : ""} USDC · {m.payments} paid
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!!busy || !live.length}
            onClick={() => void pause()}
          >
            {busy === "pause" ? <Spinner /> : paused ? <Play /> : <Pause />}{" "}
            {paused ? "Resume the crew" : "Pause the crew"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!!busy || !live.length}
            onClick={() => void retire()}
          >
            {busy === "retire" ? <Spinner /> : null} Retire the crew (one signature)
          </Button>
        </div>
        {error ? <p className="text-md text-ob-danger-text">{error}</p> : null}
      </div>
    </Section>
  );
}
