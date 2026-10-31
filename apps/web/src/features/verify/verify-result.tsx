/**
 * The verify result's two blocks, shared by `/verify/:ref` and the public proof page (H5): the
 * verdict banner and the list of checks. Drawn once so a shared proof can never look more (or less)
 * verified than the page the owner sees.
 */
import { CheckCircle2, CircleMinus, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
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

export function CheckList({ checks }: { checks: Check[] }) {
  return (
    <ul className="ob-group" aria-label="Checks">
      {checks.map((c) => (
        <li key={c.name} className="flex items-start gap-3 px-4 py-3 text-md">
          {c.ok === null ? (
            <CircleMinus className="mt-0.5 size-4 shrink-0 text-ob-dim" aria-hidden />
          ) : c.ok ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ob-success" aria-hidden />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0 text-ob-danger" aria-hidden />
          )}
          <span className="min-w-0">
            <span className="font-medium text-ob-text">{c.name}</span>{" "}
            <span className="break-all text-ob-muted">{c.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
