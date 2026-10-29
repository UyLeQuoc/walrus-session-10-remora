/**
 * N20/H2: the public status page. Anyone can open it without signing in. It reads the safe
 * `GET /api/status` and shows a name and a status per item, nothing more. It refreshes every 60 s
 * and pauses while the tab is hidden.
 */
import { useQuery } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, CircleHelp, CircleX } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { PublicStatus } from "./status-contract";

const OVERALL = {
  ok: "All systems operational",
  degraded: "Some systems are degraded",
  down: "Major outage",
} as const;

const LABEL = { ok: "Operational", degraded: "Degraded", down: "Down" } as const;

const BADGE = { ok: "success", degraded: "warning", down: "destructive" } as const;

const ICON = { ok: CircleCheck, degraded: CircleAlert, down: CircleX } as const;

async function fetchStatus(): Promise<PublicStatus> {
  const res = await apiFetch("/api/status");
  if (!res.ok) throw new Error(`status ${res.status}`);
  return PublicStatus.parse(await res.json());
}

export function StatusPage() {
  const query = useQuery({
    queryKey: ["public-status"],
    queryFn: fetchStatus,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const report = query.data;
  const unknown = query.isError && !report;

  return (
    <Page title="Status" description="Whether Remora's services are up right now." index>
      <PageHeader title="Status" description="Whether Remora's services are up right now." />

      {query.isPending ? <Skeleton className="h-48 w-full" data-testid="status-loading" /> : null}

      {unknown ? (
        <Section title="Status unknown">
          <p
            className="flex items-center gap-2 text-sm text-ob-secondary"
            data-testid="status-unknown"
          >
            <CircleHelp className="size-4 shrink-0" aria-hidden />
            We could not reach the status check. Try again in a minute.
          </p>
        </Section>
      ) : null}

      {report ? (
        <Section title="Systems">
          <p
            className="text-lg font-medium"
            data-testid="status-overall"
            data-status={report.status}
          >
            {OVERALL[report.status]}
          </p>
          <ul className="flex flex-col gap-2" aria-label="Systems">
            {report.items.map((item) => {
              const Icon = ICON[item.status];
              return (
                <li
                  key={item.name}
                  className="flex items-center gap-2 rounded-ob-card border border-ob-border p-3 text-sm"
                  data-testid="status-item"
                  data-status={item.status}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                  <Badge variant={BADGE[item.status]}>{LABEL[item.status]}</Badge>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}
    </Page>
  );
}
