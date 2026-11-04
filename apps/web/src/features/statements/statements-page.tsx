/**
 * `/statements` (E6, ADR-0122): a month of what your remoras paid. ADR-0103: the total and who paid
 * it as big numbers, a bar a day, what's worth a look, then per remora and per payee, and the CSV.
 * It prints as the page alone, in the light theme.
 */
import type { Statement, StatementFlag } from "@remora/schema";
import {
  CircleCheck,
  Coins,
  Download,
  type LucideIcon,
  OctagonX,
  Printer,
  ReceiptText,
  Tag,
  TrendingUp,
  UserPlus,
  Wallet,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Empty, Problem, Stat, StatRow } from "@/components/visual";
import { monthLabel, recentMonths } from "@/features/remoras/cost";
import { RequireOwner } from "@/features/remoras/hooks";
import { usdc } from "@/lib/usdc";
import { DataTable, SettingsGroup, SettingsRow, SurfaceCard } from "@/openbot/pages";
import "./print.css";
import { dayBars, dayLabel, FLAG_TITLE, isNew, monthOptions } from "./statement";
import { useCsvDownload, usePrintInLight, useStatement } from "./use-statement";

const FLAG_ICON: Record<StatementFlag["kind"], LucideIcon> = {
  spike: TrendingUp,
  new_payee: UserPlus,
  price_change: Tag,
  price_hike: Tag,
  failed_run: OctagonX,
};

const chart = { usdc: { label: "USDC", color: "var(--chart-1)" } } satisfies ChartConfig;

function Days({ s }: { s: Statement }) {
  return (
    <SurfaceCard data-print-avoid>
      <ChartContainer
        config={chart}
        className="aspect-auto h-40 w-full"
        data-testid="statement-days"
      >
        <BarChart data={dayBars(s)} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--openbot-border-strong)" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            minTickGap={12}
            tickMargin={6}
            fontSize={11}
            stroke="var(--openbot-text-muted)"
          />
          <YAxis
            width={44}
            tickLine={false}
            axisLine={false}
            tickCount={3}
            fontSize={11}
            stroke="var(--openbot-text-muted)"
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar
            dataKey="usdc"
            fill="var(--color-usdc)"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
    </SurfaceCard>
  );
}

function Flags({ s }: { s: Statement }) {
  if (!s.flags.length)
    return (
      <p className="flex items-center gap-2 text-md text-ob-muted" data-testid="statement-calm">
        <CircleCheck className="size-4 text-ob-success-text" aria-hidden /> Nothing unusual
      </p>
    );
  return (
    <SettingsGroup as="ul" data-print-avoid>
      {s.flags.map((f, i) => {
        const Icon = FLAG_ICON[f.kind];
        return (
          <SettingsRow
            as="li"
            key={`${f.kind}-${f.at}-${i}`}
            media={<Icon className="size-4" aria-hidden />}
            title={FLAG_TITLE[f.kind]}
            description={f.summary}
            actions={<span className="text-xs text-ob-muted tabular-nums">{dayLabel(f.day)}</span>}
            data-testid="statement-flag"
            data-kind={f.kind}
          />
        );
      })}
    </SettingsGroup>
  );
}

function Totals({
  rows,
  name,
  testId,
}: {
  rows: { key: string; label: ReactNode; amount: string; payments: number }[];
  name: string;
  testId: string;
}) {
  return (
    <DataTable data-testid={testId} data-print-avoid>
      <thead>
        <tr>
          <th>{name}</th>
          <th data-align="right">Payments</th>
          <th data-align="right">USDC</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <td>{r.label}</td>
            <td data-align="right" data-numeric>
              {r.payments}
            </td>
            <td data-align="right" data-numeric>
              {usdc(r.amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

function Body({ s }: { s: Statement }) {
  return (
    <>
      <StatRow>
        <Stat
          label="Paid"
          icon={<ReceiptText />}
          value={usdc(s.total)}
          unit="USDC"
          of={`${s.payments} payment${s.payments === 1 ? "" : "s"}`}
          size="lg"
          data-testid="statement-total"
        />
        <Stat
          label="By remoras"
          icon={<Coins />}
          value={usdc(s.byRemoras)}
          unit="USDC"
          of="their limits"
        />
        <Stat
          label="Approved by you"
          icon={<Wallet />}
          value={usdc(s.byOwner)}
          unit="USDC"
          of="your wallet"
        />
        <Stat
          label="Failed"
          icon={<OctagonX />}
          value={s.failed}
          tone={s.failed ? "warning" : "default"}
          of="attempts"
          data-testid="statement-failed"
        />
      </StatRow>
      <Section title="Worth a look">
        <Flags s={s} />
      </Section>
      {s.payments ? (
        <>
          <Section title="Day by day">
            <Days s={s} />
          </Section>
          <div className="grid items-start gap-8 lg:grid-cols-2">
            <Section title="By remora">
              <Totals
                name="Remora"
                testId="statement-remoras"
                rows={s.remoras.map((r) => ({ ...r, key: r.id, label: r.name }))}
              />
            </Section>
            <Section title="By payee">
              <Totals
                name="Payee"
                testId="statement-payees"
                rows={s.payees.map((p) => ({
                  ...p,
                  key: p.payee,
                  label: (
                    <span className="inline-flex items-center gap-2">
                      {p.label}
                      {isNew(p.firstPaid, s) ? <Badge variant="outline">new</Badge> : null}
                    </span>
                  ),
                }))}
              />
            </Section>
          </div>
        </>
      ) : (
        <Empty title="No payments this month." />
      )}
      <p className="text-xs text-ob-muted">
        Days in {s.timezone}. {s.network === "testnet" ? "Testnet USDC." : "USDC."}
      </p>
    </>
  );
}

function Statements() {
  usePrintInLight();
  const [month, setMonth] = useState<string | null>(null);
  const q = useStatement(month);
  const csv = useCsvDownload();
  const shown = month ?? q.data?.month ?? null;
  return (
    <Page title="Statements" description="What your remoras paid, month by month.">
      <div data-statement className="flex flex-col gap-6">
        <PageHeader
          title="Statements"
          description={shown ? monthLabel(shown) : "This month"}
          actions={
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <Select value={shown ?? ""} onValueChange={setMonth} disabled={!shown}>
                <SelectTrigger aria-label="Month" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions(shown, recentMonths()).map((m) => (
                    <SelectItem key={m} value={m}>
                      {monthLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                disabled={!shown || csv.busy}
                onClick={() => shown && void csv.save(shown)}
              >
                {csv.busy ? <Spinner /> : <Download />}
                Download CSV
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Print"
                title="Print"
                onClick={() => window.print()}
              >
                <Printer />
              </Button>
            </div>
          }
        />
        {csv.error ? <p className="text-md text-ob-danger-text print:hidden">{csv.error}</p> : null}
        {q.isPending ? (
          <div className="flex flex-col gap-4" data-testid="statement-loading">
            <Skeleton className="h-24 w-full rounded-ob-card" />
            <Skeleton className="h-40 w-full rounded-ob-card" />
          </div>
        ) : q.isError ? (
          <Problem
            title="Can't read your statement right now."
            detail={q.error.message}
            onRetry={() => void q.refetch()}
          />
        ) : (
          <Body s={q.data} />
        )}
      </div>
    </Page>
  );
}

export function StatementsPage() {
  return <RequireOwner what="your statements">{() => <Statements />}</RequireOwner>;
}
