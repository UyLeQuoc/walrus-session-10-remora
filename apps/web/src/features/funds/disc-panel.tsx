/**
 * The owner's Discs (spending limits) on this network: one row each, spent against its cap as a
 * meter (ADR-0103), its per-payment cap and payees, and pause or resume.
 */
import { buildPause, type OwnedDisc, toDiscError } from "@remora/disc-sdk";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Section } from "@/components/app/page";
import { RemoraAvatar } from "@/components/app/remora-avatar";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, Meter } from "@/components/visual";
import { api } from "@/features/remoras/api";
import { useLoad } from "@/features/remoras/hooks";
import type { Network } from "@/lib/network";
import { formatUsdc, usdc } from "@/lib/usdc";
import { SettingsGroup } from "@/openbot/pages";
import { DISCS_CHANGED, useOwnerDiscs } from "./discs";
import { useSignAndRun } from "./sign";

function DiscRow({
  d,
  cfg,
  owner,
}: {
  d: OwnedDisc;
  cfg: NonNullable<ReturnType<typeof useOwnerDiscs>["cfg"]>;
  /** The remora this limit belongs to, matched by its Disc id (ADR-0103). */
  owner?: { id: string; name: string };
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
  // The month's window when the Disc has one (what the wizard set), else its lifetime cap.
  const rl = d.allowance.rateLimit;
  const cap = rl ? rl.limit.toString() : d.allowance.lifetimeCap;
  const spentUnits = rl ? rl.spent.toString() : d.allowance.currentSpend;
  const spent = Number(formatUsdc(spentUnits, 6));
  const limit = cap ? Number(formatUsdc(cap, 6)) : null;
  const days = d.allowance.expiryMs
    ? Math.ceil((Number(d.allowance.expiryMs) - Date.now()) / 86_400_000)
    : null;
  const endsIn =
    days === null
      ? null
      : days <= 0
        ? "ended"
        : days === 1
          ? "ends tomorrow"
          : `ends in ${days} days`;
  return (
    <li className="flex min-w-0 flex-col gap-2.5 px-4 py-3.5 text-md" data-testid="disc-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium text-ob-text">
          {owner ? <RemoraAvatar id={owner.id} size={22} still /> : null}
          <span className="min-w-0 truncate" title={d.disc.name}>
            {owner?.name ?? d.disc.name}
          </span>
          <StatusBadge status={d.disc.paused ? "paused" : "live"} />
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
      {limit !== null && limit > 0 ? (
        <Meter
          value={spent}
          max={limit}
          label={`${d.disc.name}: spent of its limit`}
          left={
            <span className="text-sm">
              <b className="font-semibold text-ob-text">{usdc(spentUnits)}</b> / {usdc(cap ?? "0")}{" "}
              USDC spent{rl ? " this month" : ""}
            </span>
          }
        />
      ) : null}
      <p className="flex flex-wrap gap-1.5 text-xs text-ob-secondary tabular-nums">
        <Badge variant="outline">≤ {usdc(d.disc.perPaymentCap)} USDC a payment</Badge>
        <Badge variant="outline">
          pays {d.disc.payees.length} address{d.disc.payees.length === 1 ? "" : "es"}
        </Badge>
        {endsIn ? <Badge variant="outline">{endsIn}</Badge> : null}
      </p>
    </li>
  );
}

export function DiscPanel({ owner, network }: { owner: string; network: Network }) {
  const { discs, error, cfg, reload } = useOwnerDiscs(owner, network);
  const remoras = useLoad(() => api.remoras(), [network]);
  const byDisc = new Map(
    (remoras.data?.remoras ?? [])
      .filter((r) => r.discId)
      .map((r) => [r.discId as string, { id: r.id, name: r.name }]),
  );
  return (
    <Section
      title="Spending limits"
      hint="Each remora spends only within its spending limit. Sui enforces it, not us: the remora's key can't pay past it."
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
        <Empty
          title="No spending limits yet. Each new remora gets one."
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
              <DiscRow key={d.disc.id} d={d} cfg={cfg} owner={byDisc.get(d.disc.id)} />
            ))}
          </SettingsGroup>
        </>
      )}
    </Section>
  );
}
