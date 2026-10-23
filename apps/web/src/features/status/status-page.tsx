/**
 * N20: the public status page. Anyone can open it without signing in. It shows the overall health
 * and each item's name, status and detail. The `fix` and `value` fields stay internal and are not shown.
 * It refreshes every 60 s.
 */
import type { HealthReport } from "@remora/schema";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

const OVERALL = {
  ok: "All systems operational",
  degraded: "Some systems are degraded",
  down: "Major outage",
} as const;

const LABEL = { ok: "Operational", degraded: "Degraded", down: "Down" } as const;

const BADGE = {
  ok: "secondary",
  degraded: "warning",
  down: "destructive",
} as const;

export function StatusPage() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/health/deep");
      if (!res.ok) throw new Error(`status ${res.status}`);
      setReport((await res.json()) as HealthReport);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Status</h1>

      {failed ? (
        <Alert variant="destructive">
          <AlertTitle>Status unavailable</AlertTitle>
          <AlertDescription>
            We could not reach the status check. Try again in a minute.
          </AlertDescription>
        </Alert>
      ) : null}

      {!report && !failed ? <Skeleton className="h-48 w-full" /> : null}

      {report && !failed ? (
        <>
          <p
            className="text-lg font-medium"
            data-testid="status-overall"
            data-status={report.status}
          >
            {OVERALL[report.status]}
          </p>
          <ul className="flex flex-col gap-2" aria-label="Systems">
            {report.items.map((item) => (
              <li
                key={item.name}
                className="flex flex-col gap-1 rounded-xl border p-3 text-sm"
                data-testid="status-item"
                data-status={item.status}
              >
                <span className="flex items-center gap-2 font-medium">
                  {item.name}
                  <Badge variant={BADGE[item.status]} className="ml-auto">
                    {LABEL[item.status]}
                  </Badge>
                </span>
                <span className="text-muted-foreground">{item.detail}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </main>
  );
}
