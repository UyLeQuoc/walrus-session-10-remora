/**
 * `/audit/:capsuleId` (U19 B1, ADR-0145): an auditor opens a remora's Wakes that its owner shared,
 * with no account. Connect a testnet wallet, sign a Seal session key, and the bundle is fetched from
 * Walrus and decrypted in this browser; every receipt is then checked against Sui here, and every
 * anchored Wake shows its Merkle proof. The bundle is data: everything in it renders as text only.
 * After a revoke or the expiry the key servers refuse, and the page says so.
 */
import type { AuditBundle, AuditWake } from "@remora/schema";
import { CheckCircle2, KeyRound, ShieldAlert, XCircle } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Hash } from "@/components/hash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Checks, Digest, Problem } from "@/components/visual";
import { WalletPicker } from "@/components/wallet-picker";
import { AnchorProofCard } from "@/features/verify/anchor-proof";
import { usdc } from "@/lib/usdc";
import { cn } from "@/lib/utils";
import { anchorSummary, matchLine, type ReceiptCheck, receiptsOf } from "./checks";
import { useAudit } from "./use-audit";

const day = (iso: string | number) => new Date(iso).toISOString().slice(0, 10);
/** The range ends before `to`, so its last day is the one before. */
const lastDay = (iso: string) => day(Date.parse(iso) - 1);
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** One labelled line of the bundle, as plain text. */
function Line({ label, children }: { label: string; children: string }) {
  return (
    <p className="text-sm [overflow-wrap:anywhere]">
      <span className="text-ob-muted">{label}: </span>
      <span className="whitespace-pre-wrap">{children}</span>
    </p>
  );
}

const amountText = (p: NonNullable<AuditWake["payment"]>) =>
  /::usdc::USDC$/i.test(p.coinType) ? `${usdc(p.amount)} USDC` : `${p.amount} (${p.coinType})`;

function WakeRow({
  w,
  check,
  network,
}: {
  w: AuditWake;
  check: ReceiptCheck | null | undefined;
  network: string;
}) {
  const [open, setOpen] = useState(false);
  const d = w.wake.intent.decision;
  const sonar = w.wake.intent.sonar;
  const status = w.payment
    ? check
      ? check.ok
        ? "matches Sui"
        : "doesn't match Sui"
      : "checking…"
    : w.anchor
      ? "anchored"
      : "not anchored yet";
  return (
    <li
      className="flex flex-col gap-2 rounded-lg border border-ob-border bg-ob-raised p-3"
      data-testid="audit-wake"
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="tabular-nums text-ob-muted">{new Date(w.at).toLocaleString()}</span>
        <Badge variant="outline">{d.action}</Badge>
        {w.payment ? (
          <span>
            {amountText(w.payment)} to {w.payment.payee}
          </span>
        ) : null}
        <span
          className={cn(
            "ml-auto text-xs",
            check && !check.ok ? "text-ob-danger-text" : "text-ob-secondary",
          )}
          data-testid="audit-wake-status"
        >
          {status}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide" : "Details"}
        </Button>
      </div>
      {w.question !== undefined ? <Line label="Question">{w.question}</Line> : null}
      <Line label="Decided">{d.reason}</Line>
      {open ? (
        <div
          className="flex flex-col gap-2 border-t border-ob-border pt-2"
          data-testid="audit-wake-details"
        >
          <Line label="Trigger">{`${w.wake.intent.trigger.kind} · ${w.wake.intent.trigger.ref}`}</Line>
          <Line label="Safety check">
            {`${sonar.verdict}${sonar.reasons.length ? `: ${sonar.reasons.join("; ")}` : ""}`}
          </Line>
          <Line label="Model">{w.wake.intent.model.id}</Line>
          <Line label="Memories it cited">
            {w.memories.length ? w.memories.join(", ") : "none"}
          </Line>
          <Line label="Intent hash">{w.intentHash}</Line>
          {w.wake.result.error ? <Line label="Error">{w.wake.result.error}</Line> : null}
          {w.payment ? (
            <>
              <p className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="text-ob-muted">Paid to </span>
                <Hash value={w.payment.payTo} label="payTo" />
                <span className="text-ob-muted"> in </span>
                <Digest value={w.payment.digest} network={network} />
              </p>
              {check ? (
                <Checks
                  label="Receipt checks"
                  items={check.checks.map((c) => ({
                    label: c.name,
                    state: c.ok ? ("pass" as const) : ("fail" as const),
                    detail: c.detail,
                  }))}
                />
              ) : null}
            </>
          ) : (
            <AnchorProofCard wake={w.wake} anchor={w.anchor} />
          )}
        </div>
      ) : null}
    </li>
  );
}

export function AuditBundleView({
  bundle,
  results,
}: {
  bundle: AuditBundle;
  results: (ReceiptCheck | null)[];
}) {
  const paid = receiptsOf(bundle);
  const byReceipt = new Map(paid.map((w, i) => [w.receiptId, results[i]]));
  const done = results.every(Boolean);
  const allOk = done && results.every((r) => r?.ok);
  const anchors = anchorSummary(bundle);
  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "flex flex-col gap-1 rounded-ob-card border px-5 py-4",
          !done
            ? "border-ob-border"
            : allOk
              ? "border-ob-success-soft bg-ob-success-soft"
              : "border-ob-danger-soft bg-ob-danger-soft",
        )}
      >
        <p className="flex items-center gap-2 text-base font-semibold" data-testid="audit-match">
          {!done ? (
            <Spinner />
          ) : allOk ? (
            <CheckCircle2 className="size-5 text-ob-success" aria-hidden />
          ) : (
            <XCircle className="size-5 text-ob-danger" aria-hidden />
          )}
          {paid.length ? matchLine(results, paid.length) : "No paid receipts in this range"}
        </p>
        <p className="text-sm text-ob-secondary" data-testid="audit-anchors">
          {anchors.anchored
            ? `${anchors.holding} of ${anchors.anchored} anchored Wakes reach their Merkle root here; open one to check its root on Sui.`
            : "No Wake in this range is anchored yet."}
        </p>
        <p className="text-sm text-ob-secondary">
          {`${bundle.count} Wakes from ${day(bundle.range.from)} to ${lastDay(bundle.range.to)} · question text ${bundle.includesQuestions ? "included" : "left out"} · decrypted in this browser`}
        </p>
      </div>
      <ul className="flex flex-col gap-2" aria-label="Wakes">
        {bundle.wakes.map((w) => (
          <WakeRow
            key={w.receiptId}
            w={w}
            check={byReceipt.get(w.receiptId)}
            network={bundle.remora.network}
          />
        ))}
      </ul>
    </div>
  );
}

export function AuditPage() {
  const { capsuleId = "" } = useParams();
  const { access, state, open, address } = useAudit(capsuleId);

  if (state.phase === "missing")
    return <Problem title="This audit link doesn't exist." detail={state.message} />;
  if (!access)
    return (
      <Page title="Audit">
        <Skeleton className="h-40 w-full" />
      </Page>
    );
  const busy = state.phase === "opening";
  const otherWallet = !!address && !same(address, access.auditor);
  return (
    <Page
      title={`Audit ${access.remora}`}
      description="A remora's Wakes, shared with an auditor through Seal."
    >
      <PageHeader
        title={`${access.remora}'s Wakes`}
        description={`${access.count} Wakes from ${day(access.range.from)} to ${lastDay(access.range.to)}, shared until ${day(access.expiresMs)}.`}
        hint="The owner sealed these Wakes on Walrus so only one wallet can open them. They're decrypted here, in your browser, and every receipt is checked against Sui on this page."
      />
      {state.phase === "open" ? (
        <AuditBundleView bundle={state.bundle} results={state.results} />
      ) : (
        <Section
          title="Open the bundle"
          hint="No account needed: your wallet signs a Seal session key, nothing else."
        >
          <div className="flex flex-col gap-3" data-testid="audit-gate">
            <p className="flex flex-wrap items-center gap-2 text-md">
              <KeyRound className="size-4 text-ob-muted" aria-hidden /> Shared with
              <Hash value={access.auditor} label="auditor" />
              <span className="text-ob-muted">on {access.network}</span>
            </p>
            {otherWallet ? (
              <p className="text-sm text-ob-warning-text">
                You're connected as {short(address ?? "")}; only {short(access.auditor)} can open
                it.
              </p>
            ) : null}
            {state.phase === "refused" ? (
              <p
                className="flex items-center gap-2 text-md text-ob-danger-text"
                data-testid="audit-refused"
              >
                <ShieldAlert className="size-4" aria-hidden /> {state.message}
              </p>
            ) : null}
            {state.phase === "failed" ? (
              <p className="text-md text-ob-danger-text" data-testid="audit-failed">
                {state.message}
              </p>
            ) : null}
            {address ? (
              <Button
                type="button"
                className="self-start"
                disabled={busy || state.phase === "loading"}
                data-testid="audit-open"
                onClick={() => void open()}
              >
                {busy ? <Spinner /> : <KeyRound className="size-4" aria-hidden />}{" "}
                {busy ? state.step : "Sign and open"}
              </Button>
            ) : (
              <WalletPicker label="Connect a testnet wallet" className="self-start" />
            )}
          </div>
        </Section>
      )}
    </Page>
  );
}
