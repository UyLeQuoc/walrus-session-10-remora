/**
 * C3 (ADR-0148): a Treasurer watches the team's addresses and writes a treasury report (in, out,
 * top counterparties, runway) every Monday or now. Requests, from you, Telegram or a signed webhook,
 * wait here as approvals: it never pays, you pay each from your own wallet.
 */
import { useSignTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import type { RemoraView } from "@remora/schema";
import { Check, HandCoins, Link2, Link2Off, NotebookPen, Wallet, X } from "lucide-react";
import { useState } from "react";
import { Section } from "@/components/app/page";
import { Time } from "@/components/app/time";
import { CopyButton } from "@/components/copy-button";
import { Hash } from "@/components/hash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Problem } from "@/components/visual";
import { explorerTx, usdc } from "@/lib/usdc";
import { api } from "./api";
import { useLoad } from "./hooks";
import { type TreasuryView, treasuryApi, units } from "./treasury-api";

type Report = TreasuryView["reports"][number];

function ReportBlock({ report, onChanged }: { report: Report; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rep = report.report;
  const share = async (on: boolean) => {
    setBusy(true);
    setError("");
    const out = on ? await treasuryApi.share(report.id) : await treasuryApi.unshare(report.id);
    setBusy(false);
    if (!out.ok) return setError(out.error);
    onChanged();
  };
  return (
    <div className="flex flex-col gap-3" data-testid="treasury-report">
      <p className="flex flex-wrap items-center gap-2 text-sm text-ob-muted">
        {rep.from} to {rep.to} · written <Time value={report.at} />
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {rep.coins.map((c) => (
          <div key={c.coinType} className="rounded-lg bg-ob-surface-2 p-3 text-md">
            <p className="font-medium">{c.symbol}</p>
            <p className="tabular-nums">
              {units(c.in, c.decimals)} in · {units(c.out, c.decimals)} out
              {BigInt(c.internal) > 0n ? ` · ${units(c.internal, c.decimals)} inside the team` : ""}
            </p>
            <p className="text-sm text-ob-secondary" data-testid="treasury-runway">
              {c.balance === null
                ? "Balance unavailable"
                : c.runwayDays === null
                  ? `Holds ${units(c.balance, c.decimals)}, no burn`
                  : `Holds ${units(c.balance, c.decimals)}: ${c.runwayDays} days at ${units(c.burnPerDay, c.decimals)} a day`}
            </p>
          </div>
        ))}
      </div>
      {rep.addresses.some((a) => a.flows.length) ? (
        <ul className="flex flex-col gap-1 text-sm" aria-label="Per address">
          {rep.addresses
            .filter((a) => a.flows.length)
            .map((a) => (
              <li key={a.address} className="flex flex-wrap items-center gap-2">
                <b>{a.label ?? a.suins ?? "Address"}</b>
                <Hash value={a.address} label="address" />
                <span className="tabular-nums text-ob-secondary">
                  {a.flows
                    .map(
                      (f) =>
                        `${units(f.in, f.decimals)} ${f.symbol} in, ${units(f.out, f.decimals)} out`,
                    )
                    .join("; ")}
                </span>
              </li>
            ))}
        </ul>
      ) : null}
      {rep.counterparties.length ? (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium">Top counterparties</p>
          <ul className="flex flex-col gap-1">
            {rep.counterparties.map((p) => (
              <li key={`${p.address}-${p.coinType}`} className="flex flex-wrap items-center gap-2">
                {p.team ? <Badge variant="secondary">{p.team} · team</Badge> : null}
                <Hash value={p.address} label="counterparty" />
                <span className="tabular-nums text-ob-secondary">
                  {p.transfers}× · {units(p.in, p.decimals)} in, {units(p.out, p.decimals)} out{" "}
                  {p.symbol}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-ob-muted">No transfers this week.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {report.shareUrl ? (
          <>
            <code
              className="min-w-0 text-xs [overflow-wrap:anywhere]"
              data-testid="treasury-share-url"
            >
              {report.shareUrl}
            </code>
            <CopyButton value={report.shareUrl} label="report link" variant="ghost" />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void share(false)}
            >
              <Link2Off className="size-4" aria-hidden /> Stop sharing
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void share(true)}
            data-testid="treasury-share"
          >
            {busy ? <Spinner /> : <Link2 className="size-4" aria-hidden />} Share a redacted link
          </Button>
        )}
      </div>
      {error ? <p className="text-md text-ob-danger-text">{error}</p> : null}
    </div>
  );
}

export function TreasurerCard({ r, onDone }: { r: RemoraView; onDone?: () => void }) {
  const view = useLoad(() => treasuryApi.view(r.id), [r.id]);
  const { mutateAsync: sign } = useSignTransaction();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [last, setLast] = useState<{ answer: string; digest?: string | null } | null>(null);
  const [error, setError] = useState("");
  if (view.error) return <Problem title="Can't load the treasury." detail={view.error} />;
  const v = view.data;
  const readOnly = r.status === "retired";
  const refresh = () => {
    void view.refresh();
    onDone?.();
  };

  const ask = async () => {
    if (!text.trim()) return;
    setBusy("ask");
    setError("");
    const out = await treasuryApi.request(r.id, text.trim());
    setBusy("");
    if (!out.ok) return setError(out.error);
    setLast({ answer: out.data.answer });
    setText("");
    refresh();
  };

  const report = async () => {
    setBusy("report");
    setError("");
    const out = await treasuryApi.report(r.id);
    setBusy("");
    if (!out.ok) return setError(out.error);
    refresh();
  };

  /** Your own payment, from your wallet: the server builds it, you sign, the server sends it. */
  const pay = async (approvalId: string) => {
    setBusy(approvalId);
    setError("");
    try {
      const tx = await api.approvalPayTx(approvalId);
      if (!tx.ok) throw new Error(tx.error);
      const signed = await sign({ transaction: Transaction.from(tx.data.transaction) as never });
      const out = await api.approvalPay(approvalId, {
        transaction: signed.bytes,
        signature: signed.signature,
      });
      if (!out.ok) throw new Error(out.error);
      setLast({ answer: out.data.answer, digest: out.data.digest });
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const decline = async (approvalId: string) => {
    setBusy(approvalId);
    const out = await api.reject(approvalId);
    setBusy("");
    if (!out.ok) return setError(out.error);
    refresh();
  };

  const [latest] = v?.reports ?? [];
  return (
    <Section
      title="Treasury"
      hint="It watches these addresses on Sui and reports every Monday at 9:00 your time. It never pays: every request, even yours, waits for you to pay it from your own wallet. Requests can also come from Telegram or a signed webhook (Settings → Hooks)."
      actions={
        readOnly ? null : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="-mr-3"
            disabled={busy !== ""}
            onClick={() => void report()}
            data-testid="treasury-report-now"
          >
            {busy === "report" ? <Spinner /> : <NotebookPen className="size-4" aria-hidden />}{" "}
            Report now
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-5" data-testid="treasurer-card">
        <ul className="flex flex-col gap-1" aria-label="Watched addresses">
          {(v?.watch ?? []).map((w) => (
            <li
              key={w.address}
              className="flex flex-wrap items-center gap-2 text-sm"
              data-testid="treasury-watch"
            >
              {w.label ? <b>{w.label}</b> : null}
              {w.suins ? <Badge variant="secondary">{w.suins}</Badge> : null}
              <Hash value={w.address} label="watched address" />
            </li>
          ))}
        </ul>

        {v?.pending.length ? (
          <section className="flex flex-col gap-2" aria-label="Requests waiting for you">
            {v.pending.map((p) => (
              <div
                key={p.approvalId}
                className="flex flex-col gap-2 rounded-lg border border-ob-warning/50 bg-ob-warning/10 p-3"
                data-testid="treasury-request"
              >
                <p className="text-md font-medium">{p.summary}</p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-ob-muted">to</span>
                  {p.suins ? <Badge variant="secondary">{p.suins}</Badge> : null}
                  <Hash value={p.payTo} label="payee address" />
                  <Time value={p.createdAt} className="text-xs text-ob-muted" />
                </div>
                <ul className="flex flex-col gap-0.5 text-sm">
                  {p.checks.map((c) => (
                    <li key={c.text} className="flex items-center gap-1.5">
                      {c.ok ? (
                        <Check className="size-3.5 text-ob-success-text" aria-hidden />
                      ) : (
                        <X className="size-3.5 text-ob-warning-text" aria-hidden />
                      )}
                      {c.text}
                    </li>
                  ))}
                </ul>
                {readOnly ? null : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy !== ""}
                      onClick={() => void pay(p.approvalId)}
                      data-testid="treasury-pay"
                    >
                      {busy === p.approvalId ? (
                        <Spinner />
                      ) : (
                        <Wallet className="size-4" aria-hidden />
                      )}{" "}
                      Pay from my wallet ({usdc(p.amount)} USDC)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy !== ""}
                      onClick={() => void decline(p.approvalId)}
                    >
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </section>
        ) : null}

        {readOnly ? null : (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void ask();
            }}
          >
            <Input
              aria-label="A spend request"
              placeholder={`pay 0.30 to ${v?.contacts[0]?.suins ?? v?.contacts[0]?.name ?? "huy.sui"} for design`}
              value={text}
              className="min-w-0 flex-1"
              onChange={(e) => setText(e.target.value)}
            />
            <Button
              type="submit"
              variant="outline"
              disabled={busy !== "" || !text.trim()}
              data-testid="treasury-ask"
            >
              {busy === "ask" ? <Spinner /> : <HandCoins className="size-4" aria-hidden />} Prepare
            </Button>
          </form>
        )}
        {last ? (
          <div
            className="flex flex-col gap-1 rounded-lg bg-ob-surface-2 p-3 text-md"
            data-testid="treasury-answer"
          >
            <span>{last.answer}</span>
            {last.digest ? (
              <Hash value={last.digest} href={explorerTx(r.network, last.digest)} label="receipt" />
            ) : null}
          </div>
        ) : null}
        {error ? <p className="text-md text-ob-danger-text">{error}</p> : null}

        {v ? (
          <p className="text-sm text-ob-muted">
            Contacts it may prepare payments to:{" "}
            {v.contacts.length
              ? v.contacts.map((c) => (c.suins ? `${c.name} (${c.suins})` : c.name)).join(", ")
              : "none yet"}
            . Limits: {usdc(v.limits.perRequestCap)} USDC a request, {usdc(v.limits.askedThisMonth)}{" "}
            of {usdc(v.limits.monthlyCap)} USDC asked this month.
          </p>
        ) : null}

        {latest ? (
          <ReportBlock report={latest} onChanged={() => void view.refresh()} />
        ) : v ? (
          <p className="text-md text-ob-muted">
            No report yet. The first comes Monday at 9:00, or now with Report now.
          </p>
        ) : null}
      </div>
    </Section>
  );
}
