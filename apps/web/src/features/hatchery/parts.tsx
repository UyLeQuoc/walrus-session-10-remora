/**
 * Pieces the Hatchery pages share (ADR-0046): what a shared remora may do, and what the safety review
 * found. Both show before anything is published, and again on the consent screen before a hatch.
 */
import type { SafetyReport, TemplatePermissions } from "@remora/schema";
import { ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { modelById } from "@/features/chat/models";

const TRIGGER: Record<string, string> = {
  message: "when you message it",
  cron: "on a schedule (arrives paused)",
  chain: "when your watched address moves",
};

export function PermissionsList({ permissions }: { permissions: TemplatePermissions[] }) {
  return (
    <ul className="flex flex-col gap-3" aria-label="What it can do">
      {permissions.map((p) => (
        <li
          key={p.remora}
          className="flex flex-col gap-2 rounded-lg border p-3 text-sm"
          data-testid="template-permissions"
        >
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {p.remora} <Badge variant="outline">{p.template}</Badge>
            {p.model ? <Badge variant="secondary">{modelById(p.model).label}</Badge> : null}
          </p>
          <p className="text-muted-foreground">
            Wakes {p.triggers.map((t) => TRIGGER[t] ?? t).join(", ") || "when asked"}.
          </p>
          <p>
            {p.payees.length ? (
              <>
                May pay only{" "}
                {p.payees.map((ref, i) => (
                  <span key={ref}>
                    {i ? ", " : ""}
                    <code className="rounded bg-muted px-1 text-xs">{ref}</code>
                  </span>
                ))}
                {p.budget ? `, ${p.budget}` : ""}.
              </>
            ) : (
              "Never pays."
            )}
          </p>
          <p className="text-xs text-muted-foreground">Tools: {p.tools.join(", ")}</p>
        </li>
      ))}
    </ul>
  );
}

export function SafetyPanel({ report }: { report: SafetyReport }) {
  const tone =
    report.verdict === "block" ? "destructive" : report.verdict === "warn" ? "warning" : "success";
  const Icon =
    report.verdict === "block" ? ShieldX : report.verdict === "warn" ? ShieldAlert : ShieldCheck;
  return (
    <Alert variant={tone} data-testid="safety-report" data-verdict={report.verdict}>
      <Icon />
      <AlertTitle>
        {report.verdict === "block"
          ? "Blocked by the safety review"
          : report.verdict === "warn"
            ? "Passed, with something to look at"
            : "Passed the safety review"}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-1">
        {report.findings.length ? (
          <ul className="list-disc pl-4">
            {report.findings.map((f) => (
              <li key={`${f.where}:${f.code}:${f.detail}`}>
                <span className="font-medium">{f.where}</span>: {f.detail}
              </li>
            ))}
          </ul>
        ) : (
          <span>No credentials, no injection or exfiltration phrasing, no raw addresses.</span>
        )}
        <span className="text-xs">Checked: {report.checks.join(", ")}.</span>
      </AlertDescription>
    </Alert>
  );
}

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
