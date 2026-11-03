/**
 * G5 + L1 on a remora's page (ADR-0046, ADR-0048): Proof of Learning (two decisions side by side and
 * the memory that changed the outcome, both verifiable) and learning charts drawn from this
 * remora's own Wakes and your feedback. Days without data have no point; nothing is smoothed.
 */

import type { DecisionRef, LearningSeries, ProofOfLearning } from "@remora/schema";
import { Link } from "react-router";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Section } from "@/components/app/page";
import { Time } from "@/components/app/time";
import { Hash } from "@/components/hash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/visual";
import { api } from "@/features/remoras/api";
import { useLoad } from "@/features/remoras/hooks";
import { cn } from "@/lib/utils";

const ACTION: Record<DecisionRef["action"], string> = {
  pay: "Paid",
  ping: "Pinged you",
  digest: "Digest",
  silent: "Stayed quiet",
  answer: "Answered",
};

function Decision({ label, d }: { label: string; d: DecisionRef }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-ob-lg bg-ob-control-hover p-3 text-md">
      <span className="text-xs font-medium text-ob-muted">{label}</span>
      <span className="font-medium text-ob-text">{ACTION[d.action]}</span>
      <span className="text-ob-secondary">{d.summary}</span>
      <span className="text-xs text-ob-muted">
        <Time value={d.at} /> · {d.memories.length} memor
        {d.memories.length === 1 ? "y" : "ies"} used
      </span>
      <Link className="link text-xs" to={d.verify}>
        Verify this decision
      </Link>
    </div>
  );
}

/** One proof: before, after, and the memory delta between them. */
export function ProofView({ proof }: { proof: ProofOfLearning }) {
  return (
    <div className="flex flex-col gap-3" data-testid="proof">
      <p className="text-md font-medium text-ob-text">{proof.change.summary}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Decision label="Before" d={proof.before} />
        <Decision label="After" d={proof.after} />
      </div>
      <div className="flex flex-col gap-1.5 text-md" data-testid="proof-delta">
        <span className="text-xs font-medium text-ob-muted">What it learned in between</span>
        {proof.delta.map((m) => (
          <div key={m.blobId} className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{m.namespace}</Badge>
            {m.text ? <span>“{m.text}”</span> : null}
            <Hash value={m.blobId} label="memory blob" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Under this many data points a rate is shown muted, with its count (ADR-0103). */
const FEW = 5;
const ofN = (v: number, n: number, what: string) => `${Math.round(v * n)} of ${n} ${what}`;

const CHART: Record<
  LearningSeries["metric"],
  { title: string; format: (v: number) => string; of: (v: number, n: number) => string }
> = {
  noise_rate: {
    title: "Noise rate",
    format: (v) => `${Math.round(v * 100)}%`,
    of: (v, n) => ofN(v, n, n === 1 ? "ping marked noise" : "pings marked noise"),
  },
  cost_per_useful: {
    title: "Cost per useful answer",
    format: (v) => `${v.toFixed(3)} USDC`,
    of: (_v, n) => `${n} useful answer${n === 1 ? "" : "s"}`,
  },
  memory_hit_rate: {
    title: "Answered from memory",
    format: (v) => `${Math.round(v * 100)}%`,
    of: (v, n) => ofN(v, n, n === 1 ? "answer" : "answers"),
  },
};
const config = { value: { label: "Value", color: "var(--chart-1)" } } satisfies ChartConfig;
const dataPoints = (n: number) => `${n} data point${n === 1 ? "" : "s"}`;

function SeriesChart({ s }: { s: LearningSeries }) {
  const meta = CHART[s.metric];
  const points = s.points.filter((p) => p.value !== null);
  const last = points.at(-1);
  return (
    <div className="ob-card min-w-0 gap-2" data-testid="learning-series" data-metric={s.metric}>
      <div className="flex flex-col gap-0.5">
        <span className="text-md text-ob-muted">{meta.title}</span>
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span
            className={cn(
              "text-2xl leading-8 font-semibold tracking-tight tabular-nums",
              last && last.n < FEW ? "text-ob-muted" : "text-ob-text",
            )}
            data-testid="learning-latest"
          >
            {last?.value != null ? meta.format(last.value) : "—"}
          </span>
          {last?.value != null ? (
            <span className="text-xs text-ob-muted tabular-nums" data-testid="learning-of">
              {meta.of(last.value, last.n)}
              {last.n < FEW ? " · too few to tell yet" : ""}
            </span>
          ) : null}
        </span>
      </div>
      {points.length ? (
        <ChartContainer config={config} className="aspect-auto h-36 w-full">
          <LineChart data={points} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--openbot-border-strong)" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              minTickGap={32}
              tickMargin={8}
              fontSize={11}
              stroke="var(--openbot-text-muted)"
            />
            <YAxis
              width={48}
              tickLine={false}
              axisLine={false}
              tickCount={4}
              domain={s.metric === "cost_per_useful" ? [0, "auto"] : [0, 1]}
              ticks={s.metric === "cost_per_useful" ? undefined : [0, 0.5, 1]}
              fontSize={11}
              stroke="var(--openbot-text-muted)"
              tickFormatter={(v: number) => meta.format(v)}
            />
            <ChartTooltip
              cursor={{ stroke: "var(--openbot-text-muted)", strokeWidth: 1 }}
              content={<ChartTooltipContent />}
            />
            <Line
              dataKey="value"
              type="monotone"
              stroke="var(--color-value)"
              strokeWidth={2}
              dot={{ r: 2.5, strokeWidth: 0, fill: "var(--color-value)" }}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      ) : (
        <p className="py-8 text-center text-md text-ob-muted">No data yet.</p>
      )}
      <span className="text-xs text-ob-muted">
        {s.source}. {dataPoints(points.reduce((n, p) => n + p.n, 0))}.
      </span>
    </div>
  );
}

export function LearningSection({ remoraId }: { remoraId: string }) {
  const learning = useLoad(() => api.learning(remoraId), [remoraId]);
  const proofs = useLoad(() => api.proofs(remoraId), [remoraId]);
  return (
    <>
      <Section
        title="How it's learning"
        hint="From its own receipts and your thumbs up and down. A day without data has no point."
      >
        {learning.error ? <p className="text-md text-ob-danger-text">{learning.error}</p> : null}
        {!learning.data && !learning.error ? (
          <Skeleton className="h-40 w-full rounded-ob-card" />
        ) : null}
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {(learning.data?.series ?? []).map((s) => (
            <SeriesChart key={s.metric} s={s} />
          ))}
        </div>
      </Section>
      <Section
        title="Proof of Learning"
        hint="The same kind of input, a different decision, and the memory that made the difference. A proof appears once it decides differently after learning something."
      >
        {proofs.error ? <p className="text-md text-ob-danger-text">{proofs.error}</p> : null}
        {proofs.data && !proofs.data.proofs.length ? (
          <Empty
            className="max-w-3xl"
            mood="thinking"
            title="No proof yet. Rate its answers or pings with 👍/👎 to teach it."
            action={
              <Button asChild size="sm">
                <Link to="?tab=activity">Rate recent ones</Link>
              </Button>
            }
          />
        ) : null}
        <ul className="flex max-w-3xl flex-col gap-4">
          {(proofs.data?.proofs ?? []).map((p) => (
            <li key={p.after.receiptId} className="ob-card">
              <ProofView proof={p} />
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
