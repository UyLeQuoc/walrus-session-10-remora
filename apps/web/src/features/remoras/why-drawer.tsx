/** N4: "Why?" opens the Wake behind an action: what triggered it, what it read, what it decided. */
import type { WakeView } from "@remora/schema";
import { useState } from "react";
import { Link } from "react-router";
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
import { useNetwork } from "@/lib/network";
import { explorerTx, formatUsdc } from "@/lib/usdc";
import { api } from "./api";

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
        {d.action === "pay" ? `Pay ${formatUsdc(d.amount)} USDC to ${d.payee}` : d.action}
      </Row>
      <Row label="Reason">{d.reason}</Row>
      <Row label="Trigger">
        {intent.trigger.kind} · {intent.trigger.ref}
      </Row>
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
        Sonar said {intent.sonar.verdict}
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
    <Badge variant="secondary">anchored onchain</Badge>
  ) : (
    <Badge variant="outline">not anchored</Badge>
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
            The receipt (Wake) for this action. {anchoredBadge(view.anchored)}
          </SheetDescription>
        </SheetHeader>
        <WakeDetails view={view} />
      </SheetContent>
    </Sheet>
  );
}

/** N4 on live data: loads the event's Wake when opened. */
export function WhyButton({ eventId }: { eventId: string }) {
  const [state, setState] = useState<{
    view: WakeView | null;
    summary: string;
    error: string;
  } | null>(null);
  const open = async () => {
    if (state) return;
    const r = await api.why(eventId);
    if (!r.ok) return setState({ view: null, summary: "", error: r.error });
    const w = r.data.wake;
    setState({
      view: w
        ? { wakeBlobId: null, intentHash: w.intentHash, anchored: w.anchored, wake: w.wake }
        : null,
      summary: r.data.event.summary,
      error: "",
    });
  };
  return (
    <Sheet onOpenChange={(o) => o && void open()}>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          Why?
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Why</SheetTitle>
          <SheetDescription>
            {state?.summary ?? "Loading the receipt…"}{" "}
            {state?.view ? anchoredBadge(state.view.anchored) : null}
          </SheetDescription>
        </SheetHeader>
        {state?.error ? <p className="px-4 text-sm text-destructive">{state.error}</p> : null}
        {state && !state.error && !state.view ? (
          <p className="px-4 text-sm text-muted-foreground">
            No receipt for this one: nothing was decided.
          </p>
        ) : null}
        {state?.view ? <WakeDetails view={state.view} /> : null}
      </SheetContent>
    </Sheet>
  );
}
