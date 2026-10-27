/**
 * `/lab/health` (K2, ADR-0052): the health report as a status board. Each item shows what was
 * measured and, when it isn't ok, the fix; recent errors per route sit underneath. It refreshes
 * every 30 s and never spends the relayer's budget to check it.
 */
import { HealthReport } from "@remora/schema";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const Report = HealthReport.extend({ startedAt: z.string().optional() });
type Report = z.infer<typeof Report>;

const TONE = {
  ok: "bg-success",
  degraded: "bg-warning",
  down: "bg-destructive",
} as const;
const LABEL = { ok: "ok", degraded: "degraded", down: "down" } as const;

export function HealthBoard() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await apiFetch("/api/health/deep");
      if (!res.ok) throw new Error(await errorMessage(res, "Health didn't answer."));
      setReport(Report.parse(await res.json()));
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <Page
      title="Health"
      description="Every dependency Remora needs, and what to do when one isn't ok."
    >
      <PageHeader
        title="Health"
        badge={
          report ? (
            <Badge
              variant={report.status === "ok" ? "secondary" : "outline"}
              data-testid="health-status"
            >
              {LABEL[report.status]}
            </Badge>
          ) : null
        }
        description={
          report
            ? `Checked ${new Date(report.checkedAt).toLocaleTimeString()}${report.startedAt ? ` · up since ${new Date(report.startedAt).toLocaleString()}` : ""}.`
            : "Checking…"
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void load()}
          >
            <RefreshCw /> Check again
          </Button>
        }
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!report && !error ? <Skeleton className="h-64 w-full" /> : null}
      {report ? (
        <>
          <ul className="grid gap-2 md:grid-cols-2" aria-label="Health items">
            {report.items.map((i) => (
              <li
                key={i.name}
                className="flex flex-col gap-1 rounded-xl border p-3 text-sm"
                data-testid="health-item"
                data-status={i.status}
              >
                <span className="flex items-center gap-2 font-medium">
                  <span aria-hidden className={cn("size-2 rounded-full", TONE[i.status])} />
                  {i.name}
                  <span className="ml-auto text-xs text-muted-foreground">{LABEL[i.status]}</span>
                </span>
                <span className="text-muted-foreground">{i.detail}</span>
                {i.fix ? <span className="text-xs">Fix: {i.fix}</span> : null}
              </li>
            ))}
          </ul>
          <Section
            title="Recent errors"
            description="Server failures and struggling dependencies, by route."
          >
            {report.errors.length ? (
              <ul className="flex flex-col gap-1 text-sm" aria-label="Recent errors">
                {report.errors.map((e) => (
                  <li key={`${e.route}${e.code}`} className="flex flex-wrap gap-2">
                    <code className="rounded bg-muted px-1 text-xs">{e.route}</code>
                    <Badge variant="outline">{e.code}</Badge>
                    <span className="text-muted-foreground">
                      ×{e.count}, last {new Date(e.lastAt).toLocaleTimeString()}: {e.message}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">None since the server started.</p>
            )}
          </Section>
        </>
      ) : null}
    </Page>
  );
}
