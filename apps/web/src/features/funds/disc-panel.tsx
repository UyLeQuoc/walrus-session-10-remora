/** The owner's Discs (budgets) on this network: limits, spend, pause and resume, one per row. */
import { buildPause, type OwnedDisc, toDiscError } from "@remora/disc-sdk";
import { Wallet } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Section } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Network } from "@/lib/network";
import { formatUsdc } from "@/lib/usdc";
import { SettingsGroup } from "@/openbot/pages";
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
  const used =
    cap && BigInt(cap) > 0n
      ? Number((BigInt(d.allowance.currentSpend) * 100n) / BigInt(cap))
      : null;
  return (
    <li className="flex min-w-0 flex-col gap-2.5 px-4 py-3.5 text-md" data-testid="disc-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium text-ob-text">
          {d.disc.name} <StatusBadge status={d.disc.paused ? "paused" : "live"} />
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void toggle()}
        >
          {d.disc.paused ? "Resume" : "Pause"}
        </Button>
      </div>
      {used === null ? null : (
        <Progress
          value={Math.min(100, used)}
          aria-label={`${used}% of this spending limit spent`}
        />
      )}
      <p className="text-ob-muted tabular-nums">
        {formatUsdc(d.allowance.currentSpend)}
        {cap !== null ? ` of ${formatUsdc(cap)}` : ""} USDC spent · up to{" "}
        {formatUsdc(d.disc.perPaymentCap)} a payment · {d.disc.payees.length} payee
        {d.disc.payees.length === 1 ? "" : "s"}
        {d.allowance.expiryMs
          ? ` · until ${new Date(d.allowance.expiryMs).toLocaleDateString()}`
          : ""}
      </p>
    </li>
  );
}

export function DiscPanel({ owner, network }: { owner: string; network: Network }) {
  const { discs, error, cfg, reload } = useOwnerDiscs(owner, network);
  return (
    <Section
      title="Budgets"
      description="Each remora spends only within its spending limit, which Sui enforces, not us."
    >
      {!cfg ? (
        <p className="text-md text-ob-muted">Remora isn't published on {network} yet.</p>
      ) : discs === null ? (
        <p className="text-md text-ob-muted">Reading your spending limits…</p>
      ) : error && discs.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-md">
          <span className="text-ob-danger-text">{error}</span>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      ) : discs.length === 0 ? (
        <EmptyState
          icon={<Wallet />}
          title="No budgets yet"
          description="Creating a remora sets a spending limit that Sui enforces."
          action={
            <Button asChild>
              <Link to="/remoras/new">Create a remora</Link>
            </Button>
          }
        />
      ) : (
        <>
          {error ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-md">
              <span className="text-ob-danger-text">{error}</span>
              <Button variant="outline" size="sm" onClick={() => void reload()}>
                Try again
              </Button>
            </div>
          ) : null}
          <SettingsGroup as="ul" aria-label="Spending limits">
            {discs.map((d) => (
              <DiscRow key={d.disc.id} d={d} cfg={cfg} />
            ))}
          </SettingsGroup>
        </>
      )}
    </Section>
  );
}
