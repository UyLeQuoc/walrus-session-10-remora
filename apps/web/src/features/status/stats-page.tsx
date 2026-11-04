/**
 * U17 D3 (ADR-0111): `/stats`, public. The payment rails' numbers straight from the database, per
 * network: remoras, paid calls, USDC moved, receipts matched onchain, blocked attempts and sales. Under
 * them is the latest dated load run, as it was measured. Nothing on this page is typed in by hand.
 */
import { useQuery } from "@tanstack/react-query";
import { Ban, Coins, Gauge, Receipt, ShieldCheck, Store, Users } from "lucide-react";
import { z } from "zod";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat, StatRow } from "@/components/visual";
import { apiFetch } from "@/lib/api";
import { usdc } from "@/lib/usdc";
import { DataTable } from "@/openbot/pages";

const Rails = z.object({
  remoras: z.number(),
  activeRemoras: z.number(),
  paidCalls: z.number(),
  usdcMoved: z.string(),
  anchored: z.number(),
  blocked: z.number(),
  sales: z.number(),
});
const LoadStep = z.object({
  concurrency: z.number(),
  calls: z.number(),
  paid: z.number(),
  seconds: z.number(),
  paymentsPerMinute: z.number(),
  p50Ms: z.number(),
  p95Ms: z.number(),
  p99Ms: z.number(),
});
const Stats = z.object({
  rails: z.record(z.string(), Rails),
  loadRun: z
    .object({
      at: z.string(),
      label: z.string(),
      node: z.string().optional(),
      remoras: z.number(),
      steps: z.array(LoadStep),
      paidCalls: z.number(),
      paidUsdc: z.string(),
      mustFail: z.object({ attempts: z.number(), stopped: z.number() }).loose(),
      overspends: z.number(),
      sponsorMistPerPayment: z.string().optional(),
    })
    .loose()
    .nullable(),
  at: z.string().optional(),
});

const fetchStats = async () => {
  const res = await apiFetch("/api/stats");
  if (!res.ok) throw new Error(`The server answered ${res.status}.`);
  return Stats.parse(await res.json());
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function StatsPage() {
  const q = useQuery({ queryKey: ["stats"], queryFn: fetchStats, refetchInterval: 60_000 });
  const t = q.data?.rails.testnet;
  const run = q.data?.loadRun;
  return (
    <Page title="Stats">
      <PageHeader
        title="Stats"
        description="Remora's payment rails, counted from its database. Testnet: the spending limits, payments and receipts are real; the money is testnet USDC."
      />
      {q.isPending ? (
        <Skeleton className="h-32 w-full rounded-ob-card" />
      ) : q.error || !t ? (
        <p className="text-md text-ob-muted">The numbers aren't available right now.</p>
      ) : (
        <div className="flex flex-col gap-8" data-testid="stats">
          <StatRow className="md:grid-cols-3">
            <Stat
              label="Remoras"
              icon={<Users />}
              value={t.remoras}
              of={`${t.activeRemoras} live`}
            />
            <Stat
              label="Paid calls"
              icon={<Receipt />}
              value={t.paidCalls}
              of="each one a receipt"
            />
            <Stat
              label="Moved"
              icon={<Coins />}
              value={usdc(t.usdcMoved)}
              unit="USDC"
              of="testnet"
            />
            <Stat
              label="Matched onchain"
              icon={<ShieldCheck />}
              value={t.anchored}
              of="receipts whose intent the chain shows"
            />
            <Stat label="Stopped" icon={<Ban />} value={t.blocked} of="payments refused" />
            <Stat label="Answers sold" icon={<Store />} value={t.sales} of="remora to remora" />
          </StatRow>
          {run ? (
            <Section title={`At scale · ${day(run.at)}`} hint={run.label}>
              <div className="flex flex-col gap-4" data-testid="stats-load">
                <StatRow className="md:grid-cols-4">
                  <Stat label="Remoras" icon={<Users />} value={run.remoras} />
                  <Stat
                    label="Paid calls"
                    icon={<Receipt />}
                    value={run.paidCalls}
                    of={`${usdc(run.paidUsdc)} USDC`}
                  />
                  <Stat
                    label="Stopped onchain"
                    icon={<Ban />}
                    value={`${run.mustFail.stopped}/${run.mustFail.attempts}`}
                    of="over the cap or off the list"
                  />
                  <Stat
                    label="Overspends"
                    icon={<Gauge />}
                    value={run.overspends}
                    tone={run.overspends === 0 ? "success" : "danger"}
                    of="every Disc read back"
                  />
                </StatRow>
                <DataTable>
                  <thead>
                    <tr>
                      <th data-align="right">At once</th>
                      <th data-align="right">Paid</th>
                      <th data-align="right">Payments a minute</th>
                      <th data-align="right">p50</th>
                      <th data-align="right">p95</th>
                      <th data-align="right">p99</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.steps.map((s) => (
                      <tr key={s.concurrency} data-testid="stats-step">
                        <td data-align="right" data-numeric>
                          {s.concurrency}
                        </td>
                        <td data-align="right" data-numeric>
                          {s.paid}/{s.calls}
                        </td>
                        <td data-align="right" data-numeric>
                          {s.paymentsPerMinute}
                        </td>
                        <td data-align="right" data-numeric>
                          {(s.p50Ms / 1000).toFixed(1)} s
                        </td>
                        <td data-align="right" data-numeric>
                          {(s.p95Ms / 1000).toFixed(1)} s
                        </td>
                        <td data-align="right" data-numeric>
                          {(s.p99Ms / 1000).toFixed(1)} s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
                <p className="text-xs text-ob-muted">
                  {run.node ? `${run.node}. ` : ""}
                  {run.sponsorMistPerPayment
                    ? `Sponsored gas: ${(Number(run.sponsorMistPerPayment) / 1e9).toFixed(4)} SUI a payment.`
                    : ""}
                </p>
              </div>
            </Section>
          ) : null}
        </div>
      )}
    </Page>
  );
}
