/**
 * The verify result's two blocks, shared by `/verify/:ref` and the public proof page (H5): the
 * verdict banner and the list of checks. Drawn once so a shared proof can never look more (or less)
 * verified than the page the owner sees.
 */
import { CheckCircle2, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Checks } from "@/components/visual";
import { usdc } from "@/lib/usdc";
import { cn } from "@/lib/utils";

export type Check = { name: string; ok: boolean | null; detail: string };

/** `ok: null` means "doesn't apply", which doesn't fail the receipt. */
export const allChecksOk = (checks: Check[]) => checks.every((c) => c.ok !== false);

export function VerifyVerdict({ checks, anchored }: { checks: Check[]; anchored: boolean }) {
  const allOk = allChecksOk(checks);
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-ob-card border px-5 py-4",
        allOk
          ? "border-ob-success-soft bg-ob-success-soft"
          : "border-ob-danger-soft bg-ob-danger-soft",
      )}
      data-testid="verify-verdict"
    >
      <div className="flex flex-wrap items-center gap-2">
        {allOk ? (
          <CheckCircle2 className="size-5 text-ob-success" aria-hidden />
        ) : (
          <XCircle className="size-5 text-ob-danger" aria-hidden />
        )}
        <p className="text-base font-semibold tracking-tight text-ob-text">
          {allOk ? "Verified" : "Doesn't check out"}
        </p>
        {anchored ? (
          <StatusBadge status="verified" />
        ) : (
          <Badge variant="outline">not saved onchain</Badge>
        )}
      </div>
      <p className="text-md text-ob-secondary">
        {allOk
          ? "The receipt matches the chain."
          : "At least one check did not match. Treat the claim as unproven."}
      </p>
    </div>
  );
}

/**
 * The checks in plain words (ADR-0103); the server's own name stays in the row's tooltip, so a
 * shared proof still names exactly what ran.
 */
const PLAIN: Record<string, string> = {
  "intent hash": "It did what it said",
  "transaction succeeded": "The payment went through",
  "Paid.intent matches": "The payment carries its decision",
  "payTo balance change": "The payee got the amount",
  "decided before paying": "It decided before paying",
  "signed by the remora": "Its own key signed",
  "saved onchain": "The decision is saved onchain",
};

/** "10000 of 10000" (USDC's smallest unit) reads as "0.01 of 0.01 USDC". */
function plainDetail(detail: string): string {
  const m = /^(\d+) of (\d+)$/.exec(detail);
  return m ? `${usdc(m[1] ?? "0")} of ${usdc(m[2] ?? "0")} USDC` : detail;
}

/** Each check lights up in turn (ADR-0103); `ok: null` reads as skipped, not failed. */
export function CheckList({ checks }: { checks: Check[] }) {
  return (
    <Checks
      label="Checks"
      items={checks.map((c) => ({
        label: PLAIN[c.name] ?? c.name,
        state: c.ok === null ? "skip" : c.ok ? "pass" : "fail",
        detail: (
          <span className="break-all" title={c.name}>
            {plainDetail(c.detail)}
          </span>
        ),
      }))}
    />
  );
}
