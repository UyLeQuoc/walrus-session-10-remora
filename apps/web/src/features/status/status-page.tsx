/**
 * N20/H2: the public status page. Anyone can open it without signing in. It reads the safe
 * `GET /api/status` and shows a name and a status per item, nothing more. It refreshes every 60 s
 * and pauses while the tab is hidden.
 */

import { useQuery } from "@tanstack/react-query";
import { CircleHelp } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/visual";
import { apiFetch } from "@/lib/api";
import { PublicStatus } from "./status-contract";

const OVERALL = {
  ok: "All systems operational",
  degraded: "Some systems are degraded",
  down: "Major outage",
} as const;

const LABEL = { ok: "Operational", degraded: "Degraded", down: "Down" } as const;

const BADGE = { ok: "success", degraded: "warning", down: "destructive" } as const;

/**
 * ADR-0103: the API names its checks the way the code does ("tatum (testnet)"); the page groups them
 * by what you'd do and says each in plain words. The raw name stays in the row's tooltip.
 */
const GROUPS = [
  { id: "pay", title: "Payments" },
  { id: "chain", title: "Sui" },
  { id: "memory", title: "Memory on Walrus" },
  { id: "app", title: "Remora" },
] as const;
const PLAIN: Array<[RegExp, string, (typeof GROUPS)[number]["id"]]> = [
  [/^facilitator/, "Payments (x402)", "pay"],
  [/^sponsor gas/, "Gas station", "pay"],
  [/^playground funder/, "Try-it funds", "pay"],
  [/^tatum usage/, "Tatum credits", "chain"],
  [/^tatum/, "Reading Sui (Tatum)", "chain"],
  [/^checkpoint lag/, "Wallet watching", "chain"],
  [/^relayer budget/, "Memory budget", "memory"],
  [/^relayer/, "Walrus Memory", "memory"],
  [/^memory/, "Memory writes", "memory"],
  [/^database/, "Database", "app"],
  [/^job queue/, "Background jobs", "app"],
];
const net = (name: string) => /\((testnet|mainnet)\)/.exec(name)?.[1];
function friendly(name: string): string {
  const hit = PLAIN.find(([re]) => re.test(name));
  if (!hit) return name.charAt(0).toUpperCase() + name.slice(1);
  return net(name) ? `${hit[1]} · ${net(name)}` : hit[1];
}
const groupOf = (name: string) => PLAIN.find(([re]) => re.test(name))?.[2] ?? "app";

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
      <PageHeader title="Status" description="Is Remora up right now?" />

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
        <>
          <div
            className="flex items-center gap-3 rounded-xl border border-ob-border bg-ob-raised px-4 py-3"
            data-testid="status-overall"
            data-status={report.status}
          >
            <StatusDot state={report.status} label={OVERALL[report.status]} className="size-3" />
            <p className="text-lg font-medium">{OVERALL[report.status]}</p>
          </div>
          {GROUPS.map((g) => {
            const items = report.items.filter((item) => groupOf(item.name) === g.id);
            if (!items.length) return null;
            return (
              <Section key={g.id} title={g.title}>
                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label={g.title}>
                  {items.map((item) => (
                    <li
                      key={item.name}
                      className="flex items-center gap-2.5 rounded-ob-card border border-ob-border p-3 text-sm"
                      data-testid="status-item"
                      data-status={item.status}
                      title={item.name}
                    >
                      <StatusDot state={item.status} label={LABEL[item.status]} />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {friendly(item.name)}
                      </span>
                      <Badge variant={BADGE[item.status]}>{LABEL[item.status]}</Badge>
                    </li>
                  ))}
                </ul>
              </Section>
            );
          })}
        </>
      ) : null}
    </Page>
  );
}
