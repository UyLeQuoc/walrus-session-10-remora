/**
 * U19 B1 (ADR-0145): "Share with an auditor", on a remora's Activity tab. The owner picks a date
 * range, the auditor's address or `.sui` name, 1–30 days and whether question text goes in (off by
 * default), then signs one `create`; the card shows the link to `/audit/<capsuleId>` and a Revoke
 * (one signature). The server seals the bundle; the page never sees it.
 */
import type { RemoraView } from "@remora/schema";
import { Copy, ShieldCheck, Undo2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Section } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Problem } from "@/components/visual";
import { useSignAndRun } from "@/features/funds/sign";
import { useLoad } from "@/features/remoras/hooks";
import { auditApi } from "./api";

const DAY_MS = 86_400_000;
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function AuditCard({ r }: { r: RemoraView }) {
  const view = useLoad(() => auditApi.shares(r.id), [r.id]);
  const run = useSignAndRun();
  const [from, setFrom] = useState(() => ymd(Date.now() - 7 * DAY_MS));
  const [to, setTo] = useState(() => ymd(Date.now()));
  const [auditor, setAuditor] = useState("");
  const [days, setDays] = useState("7");
  const [questions, setQuestions] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [made, setMade] = useState<string | null>(null);
  if (view.error) return <Problem title="Can't load its auditor shares." detail={view.error} />;
  const shares = view.data?.shares ?? [];

  const step = async (key: string, work: () => Promise<void>) => {
    setBusy(key);
    setError("");
    try {
      await work();
      void view.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const share = () =>
    step("share", async () => {
      const tx = await auditApi.shareTx(r.id, {
        from,
        to,
        auditor: auditor.trim(),
        days: Number(days),
        includeQuestions: questions,
      });
      if (!tx.ok) throw new Error(tx.error);
      const digest = await run(tx.data.transaction);
      const done = await auditApi.confirm(r.id, digest, tx.data.draft);
      if (!done.ok) throw new Error(done.error);
      setMade(done.data.path);
      setAuditor("");
    });

  const revoke = (capsuleId: string) =>
    step(`revoke${capsuleId}`, async () => {
      const tx = await auditApi.revokeTx(r.id, capsuleId);
      if (!tx.ok || !tx.data.transaction) throw new Error(tx.ok ? "Nothing to sign." : tx.error);
      const digest = await run(tx.data.transaction);
      const done = await auditApi.revokeConfirm(r.id, capsuleId, digest);
      if (!done.ok) throw new Error(done.error);
    });

  const full = (path: string) => `${window.location.origin}${path}`;

  return (
    <Section
      title="Share with an auditor"
      hint="An auditor reads this remora's Wakes in a date range: what it decided and why, what it paid, the memories it cited. Sealed on Walrus with Seal, opened in the auditor's browser and checked against Sui there, until the date or until you take it back. Question text stays out unless you include it."
    >
      <div className="flex flex-col gap-4" data-testid="audit-card">
        {shares.length ? (
          <ul className="flex flex-col gap-2 text-sm" aria-label="Auditor shares">
            {shares.map((s) => {
              const expired = s.expiresMs <= Date.now();
              return (
                <li
                  key={s.capsuleId}
                  className="flex flex-wrap items-center gap-2"
                  data-testid="audit-share"
                >
                  <ShieldCheck className="size-3.5 text-ob-muted" aria-hidden />
                  <span>
                    {s.count} Wakes ({s.range.from.slice(0, 10)} to{" "}
                    {ymd(Date.parse(s.range.to) - 1)}) for{" "}
                    <b>{s.auditorName ?? short(s.auditor)}</b> until {ymd(s.expiresMs)}
                  </span>
                  <Link
                    to={s.path}
                    className="text-ob-accent-text hover:underline"
                    data-testid="audit-link"
                  >
                    {s.path}
                  </Link>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Copy the auditor's link"
                    onClick={() => void navigator.clipboard?.writeText(full(s.path))}
                  >
                    <Copy className="size-3.5" aria-hidden />
                  </Button>
                  {s.revoked ? (
                    <Badge variant="outline">taken back</Badge>
                  ) : expired ? (
                    <Badge variant="outline">expired</Badge>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy !== ""}
                      data-testid="audit-revoke"
                      onClick={() => void revoke(s.capsuleId)}
                    >
                      {busy === `revoke${s.capsuleId}` ? (
                        <Spinner />
                      ) : (
                        <Undo2 className="size-4" aria-hidden />
                      )}{" "}
                      Revoke · one signature
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <Label className="flex flex-col items-start gap-1 text-sm">
            From
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Label>
          <Label className="flex flex-col items-start gap-1 text-sm">
            To
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Label>
          <Label className="flex flex-col items-start gap-1 text-sm">
            Auditor's address or .sui name
            <Input
              placeholder="0x… or auditor.sui"
              value={auditor}
              onChange={(e) => setAuditor(e.target.value)}
            />
          </Label>
          <Label className="flex flex-col items-start gap-1 text-sm">
            For how many days (1–30)
            <Input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
          </Label>
        </div>
        <Label className="flex items-center gap-2 text-sm">
          <Switch
            checked={questions}
            onCheckedChange={setQuestions}
            data-testid="audit-questions"
          />
          Include question text
        </Label>
        <Button
          type="button"
          className="self-start"
          disabled={busy !== "" || !auditor.trim()}
          data-testid="audit-share-button"
          onClick={() => void share()}
        >
          {busy === "share" ? <Spinner /> : <ShieldCheck className="size-4" aria-hidden />} Share ·
          one signature
        </Button>
        {made ? (
          <p className="text-md" data-testid="audit-made">
            Shared. Send the auditor this link:{" "}
            <Link to={made} className="text-ob-accent-text hover:underline">
              {full(made)}
            </Link>
          </p>
        ) : null}
        {error ? <p className="text-md text-ob-danger-text">{error}</p> : null}
      </div>
    </Section>
  );
}
