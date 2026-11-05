/** N4: "Why?" opens the Wake behind an action: what triggered it, what it read, what it decided. */

import type { ProofOfLearning, WakeView } from "@remora/schema";
import { useState } from "react";
import { Link } from "react-router";
import { ShellSidePanel, useHasSidePanel } from "@/app/shell";
import { Term } from "@/components/app/glossary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ProofView } from "@/features/learning/learning";
import { ShareControl } from "@/features/verify/share-control";
import { useOwnsWake } from "@/features/verify/use-owns-wake";
import { useNetwork } from "@/lib/network";
import { payeeName } from "@/lib/payee";
import { plainEvent } from "@/lib/readable";
import { explorerTx, usdc } from "@/lib/usdc";
import { api } from "./api";
import { mcpCitations } from "./why-mcp";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** The Wake's fields: decision, reason, trigger, reads, memories, Sonar, model, hash, transaction. */
export function WakeDetails({ view }: { view: WakeView }) {
  const network = useNetwork();
  const { intent, result } = view.wake;
  const d = intent.decision;
  return (
    <dl className="flex flex-col gap-3 px-4 pb-6">
      <Row label="Decision">
        {d.action === "pay" ? `Pay ${usdc(d.amount)} USDC to ${payeeName(d.payee)}` : d.action}
      </Row>
      <Row label="Reason">{plainEvent(d.reason, payeeName)}</Row>
      <Row label="Trigger">
        {intent.trigger.kind} · {intent.trigger.ref}
      </Row>
      {view.wake.via ? <Row label="Via">MCP: {view.wake.via.replace(/^mcp:/, "")}</Row> : null}
      <Row label="Read">
        {intent.inputs.objects.length} object(s) via Tatum
        {intent.inputs.checkpoint ? ` at checkpoint ${intent.inputs.checkpoint}` : ""}
      </Row>
      <Row label="Memories">
        {intent.memories.length
          ? intent.memories.map((m) => `${m.namespace} (${m.blobId})`).join(", ")
          : "none"}
      </Row>
      <Row label="Check">
        The <Term name="safety check">safety check</Term> said {intent.sonar.verdict}
        {intent.sonar.reasons.length ? `: ${intent.sonar.reasons.join("; ")}` : ""}
      </Row>
      <Row label="Model">{intent.model.id}</Row>
      <Row label="Intent hash">
        <code className="text-xs">{view.intentHash}</code>
      </Row>
      {result.tx ? (
        <Row label="Transaction">
          <a
            className="underline"
            href={explorerTx(network, result.tx)}
            target="_blank"
            rel="noreferrer"
          >
            {result.tx.slice(0, 10)}…
          </a>
        </Row>
      ) : null}
      <Row label="Verify">
        <Link className="underline" to={`/verify/${result.tx ?? ""}`}>
          Check it against the chain
        </Link>
      </Row>
    </dl>
  );
}

const anchoredBadge = (anchored: boolean) =>
  anchored ? (
    <Badge variant="secondary">saved onchain</Badge>
  ) : (
    <Badge variant="outline">not saved onchain</Badge>
  );

export function WhyDrawer({ view, label = "Why?" }: { view: WakeView; label?: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          {label}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Why {view.wake.remora} did this</SheetTitle>
          <SheetDescription>
            The <Term name="receipt">receipt</Term> for this action. {anchoredBadge(view.anchored)}
          </SheetDescription>
        </SheetHeader>
        <WakeDetails view={view} />
      </SheetContent>
    </Sheet>
  );
}

/** N4 on live data: loads the event's Wake when opened. */
/** `compact`: the 24px action-row size, for a chat line. */
export function WhyButton({ eventId, compact = false }: { eventId: string; compact?: boolean }) {
  const [state, setState] = useState<{
    view: WakeView | null;
    /** The stored Wake's id, for sharing it (H5). */
    wakeId: string | null;
    summary: string;
    error: string;
    /** G5: the proof this decision is the "after" of, if any. */
    proof: ProofOfLearning | null;
    /** ADR-0143: the MCP tools the answer called. */
    mcp: string[];
  } | null>(null);
  const [showProof, setShowProof] = useState(false);
  const [docked, setDocked] = useState(false);
  const inShell = useHasSidePanel();
  // H5: Share only for the owner of the Wake's remora (its signing address matches one of the
  // owner's remoras). False while that loads, so Share never flashes for a non-owner.
  const owns = useOwnsWake(state?.view?.wake.agent);
  const open = async () => {
    if (state) return;
    const r = await api.why(eventId);
    if (!r.ok)
      return setState({
        view: null,
        wakeId: null,
        summary: "",
        error: r.error,
        proof: null,
        mcp: [],
      });
    const w = r.data.wake;
    const proofs = w ? await api.proofs(r.data.event.remoraId) : null;
    setState({
      view: w
        ? { wakeBlobId: null, intentHash: w.intentHash, anchored: w.anchored, wake: w.wake }
        : null,
      wakeId: w?.id ?? null,
      summary: r.data.event.summary,
      mcp: mcpCitations(r.data.event.payload),
      error: "",
      proof: (proofs?.ok && proofs.data.proofs.find((p) => p.after.receiptId === w?.id)) || null,
    });
  };
  const body = (
    <>
      {state?.error ? <p className="px-4 text-sm text-destructive">{state.error}</p> : null}
      {state && !state.error && !state.view ? (
        <p className="px-4 text-sm text-muted-foreground">
          No receipt for this one: nothing was decided.
        </p>
      ) : null}
      {state?.proof ? (
        <div className="flex flex-col gap-2 px-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            aria-expanded={showProof}
            onClick={() => setShowProof((v) => !v)}
          >
            What changed?
          </Button>
          {showProof ? <ProofView proof={state.proof} /> : null}
        </div>
      ) : null}
      {state?.mcp.length ? (
        <dl className="px-4" data-testid="why-mcp">
          <Row label="MCP tools">
            {state.mcp.map((m) => (
              <code key={m} className="block text-xs">
                {m}
              </code>
            ))}
          </Row>
        </dl>
      ) : null}
      {state?.view ? <WakeDetails view={state.view} /> : null}
      {owns && state?.wakeId ? (
        <div className="flex flex-col gap-2 px-4 pb-6">
          <h3 className="text-sm font-medium">Share this proof</h3>
          <ShareControl wakeId={state.wakeId} />
        </div>
      ) : null}
    </>
  );
  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "xs" : "sm"}
      aria-expanded={inShell ? docked : undefined}
      onClick={
        inShell
          ? () => {
              setDocked(true);
              void open();
            }
          : undefined
      }
    >
      Why?
    </Button>
  );
  // In the app shell, the receipt opens in the docked side panel (ADR-0069); alone, in a sheet.
  if (inShell)
    return (
      <>
        {trigger}
        <ShellSidePanel open={docked} title="Why" onClose={() => setDocked(false)}>
          <div className="-mx-4 flex flex-col gap-3">
            <p className="px-4 text-sm text-muted-foreground">
              {state?.summary ?? "Loading the receipt…"}{" "}
              {state?.view ? anchoredBadge(state.view.anchored) : null}
            </p>
            {body}
          </div>
        </ShellSidePanel>
      </>
    );
  return (
    <Sheet onOpenChange={(o) => o && void open()}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Why</SheetTitle>
          <SheetDescription>
            {state?.summary ?? "Loading the receipt…"}{" "}
            {state?.view ? anchoredBadge(state.view.anchored) : null}
          </SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  );
}
