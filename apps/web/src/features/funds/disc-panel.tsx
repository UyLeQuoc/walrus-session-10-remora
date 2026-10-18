/** The owner's Discs (budgets) on this network: limits, spend, pause and resume, one per row. */
import { buildPause, type OwnedDisc, toDiscError } from "@remora/disc-sdk";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Network } from "@/lib/network";
import { formatUsdc } from "@/lib/usdc";
import { DISCS_CHANGED, useOwnerDiscs } from "./discs";
import { useSignAndRun } from "./sign";

function DiscRow({
  d,
  cfg,
}: {
  d: OwnedDisc;
  cfg: NonNullable<ReturnType<typeof useOwnerDiscs>["cfg"]>;
}) {
  const run = useSignAndRun();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      await run(buildPause(cfg, [d.disc.id], !d.disc.paused));
      window.dispatchEvent(new Event(DISCS_CHANGED));
    } catch (err) {
      toast.error(toDiscError(err).message);
    } finally {
      setBusy(false);
    }
  };
  const cap = d.allowance.lifetimeCap;
  return (
    <li
      className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
      data-testid="disc-row"
    >
      <div className="min-w-0">
        <p className="font-medium">
          {d.disc.name}{" "}
          {d.disc.paused ? (
            <Badge variant="destructive">paused</Badge>
          ) : (
            <Badge variant="secondary">live</Badge>
          )}
        </p>
        <p className="text-muted-foreground">
          {formatUsdc(d.allowance.currentSpend)}
          {cap !== null ? ` of ${formatUsdc(cap)}` : ""} USDC spent · up to{" "}
          {formatUsdc(d.disc.perPaymentCap)} a payment · {d.disc.payees.length} payee
          {d.disc.payees.length === 1 ? "" : "s"}
          {d.allowance.expiryMs
            ? ` · until ${new Date(d.allowance.expiryMs).toLocaleDateString()}`
            : ""}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => void toggle()}
      >
        {d.disc.paused ? "Resume" : "Pause"}
      </Button>
    </li>
  );
}

export function DiscPanel({ owner, network }: { owner: string; network: Network }) {
  const { discs, error, cfg } = useOwnerDiscs(owner, network);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Budgets (Discs)</CardTitle>
        <CardDescription>
          Each remora spends only through its Disc: a spending limit Sui enforces, not us.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!cfg ? (
          <p className="text-sm text-muted-foreground">Remora isn't published on {network} yet.</p>
        ) : discs === null ? (
          <p className="text-sm text-muted-foreground">Reading your Discs…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : discs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Discs yet. Creating a remora issues one (W2).
          </p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Discs">
            {discs.map((d) => (
              <DiscRow key={d.disc.id} d={d} cfg={cfg} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
