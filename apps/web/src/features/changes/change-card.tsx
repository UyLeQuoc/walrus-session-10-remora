/**
 * C2 (ADR-0123): a change asked for in chat, before → after. A setting applies on Apply; a limit, a
 * Disc's pause or a contact is signed in the wallet. Decided cards say what happened.
 */
import { type ChangeCard as Change, ChangeCard as ChangeSchema } from "@remora/schema";
import { ArrowRight, PenLine } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { explorerTx } from "@/lib/usdc";
import { InteractionCard } from "@/openbot";
import { useChange } from "./use-change";

/** A feed or room payload that is a change card, parsed; null for anything else. */
export function changeOf(payload: Record<string, unknown>): Change | null {
  if (payload.kind !== "change") return null;
  const parsed = ChangeSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

const STATUS: Record<Change["status"], { label: string; variant: "success" | "outline" }> = {
  pending: { label: "Waiting for you", variant: "outline" },
  applied: { label: "Done", variant: "success" },
  declined: { label: "Cancelled", variant: "outline" },
  expired: { label: "Expired", variant: "outline" },
  failed: { label: "Failed", variant: "outline" },
};

export function ChangeCard({
  id,
  change,
  network = "testnet",
  onDone,
}: {
  /** The change's event id. */
  id: string;
  change: Change;
  network?: string;
  onDone?: () => void;
}) {
  const [now, setNow] = useState(change);
  const { busy, apply, decline, sign } = useChange(id, (c) => {
    setNow(c);
    onDone?.();
  });
  const pending = now.status === "pending";
  return (
    <InteractionCard
      data-testid="change-card"
      tone={pending ? "warning" : undefined}
      title={
        <span className="flex items-center gap-2">
          <PenLine aria-hidden className="size-4" />
          {now.title}
        </span>
      }
      status={
        pending ? (
          <Badge variant="warning">{now.sign ? "Needs your signature" : "Waiting for you"}</Badge>
        ) : (
          <Badge variant={STATUS[now.status].variant}>{STATUS[now.status].label}</Badge>
        )
      }
      actions={
        pending ? (
          <>
            <Button
              type="button"
              disabled={!!busy}
              onClick={() => void (now.sign ? sign() : apply())}
            >
              {now.sign ? "Sign" : "Apply"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!!busy}
              onClick={() => void decline()}
            >
              Cancel
            </Button>
            {busy ? (
              <span className="flex items-center gap-1 text-md text-ob-muted">
                <Spinner /> {busy}
              </span>
            ) : null}
          </>
        ) : undefined
      }
    >
      <dl className="flex flex-col gap-1.5">
        {now.diff.map((d) => (
          <div key={d.label} className="flex flex-wrap items-center gap-2 text-md">
            <dt className="text-ob-muted">{d.label}</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <span className="text-ob-secondary line-through decoration-ob-border-strong">
                {d.before}
              </span>
              <ArrowRight aria-label="becomes" className="size-3.5 text-ob-muted" />
              <span className="font-medium text-ob-text">{d.after}</span>
            </dd>
          </div>
        ))}
      </dl>
      {now.note ? <p className="mt-2 text-md text-ob-muted">{now.note}</p> : null}
      {now.digest ? (
        <a
          className="mt-2 inline-block text-md underline-offset-2 hover:underline"
          href={explorerTx(network, now.digest)}
          target="_blank"
          rel="noreferrer"
        >
          Signed onchain ↗
        </a>
      ) : null}
    </InteractionCard>
  );
}
