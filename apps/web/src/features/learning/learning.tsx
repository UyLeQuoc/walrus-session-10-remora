/**
 * G5 + L1 on a remora's page (ADR-0046, ADR-0048): Proof of Learning (two decisions side by side and
 * the memory that changed the outcome, both verifiable) and learning charts drawn from this
 * remora's own Wakes and your feedback. Days without data have no point; nothing is smoothed.
 */
import type { DecisionRef, LearningSeries, ProofOfLearning } from "@remora/schema";
import { Link } from "react-router";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Section } from "@/components/app/page";
import { Hash } from "@/components/hash";
import { Badge } from "@/components/ui/badge";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/features/remoras/api";
import { useLoad } from "@/features/remoras/hooks";

const ACTION: Record<DecisionRef["action"], string> = {
  pay: "Paid",
  ping: "Pinged you",
  digest: "Digest",
  silent: "Stayed quiet",
  answer: "Answered",
};

function Decision({ label, d }: { label: string; d: DecisionRef }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border p-3 text-sm">
      <span className="text-xs text-muted-foreground uppercase">{label}</span>
      <span className="font-medium">{ACTION[d.action]}</span>
      <span className="text-muted-foreground">{d.summary}</span>
      <span className="text-xs text-muted-foreground">
        {new Date(d.at).toLocaleString()} · {d.memories.length} memor
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
      <p className="text-sm">{proof.change.summary}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Decision label="Before" d={proof.before} />
        <Decision label="After" d={proof.after} />
      </div>
      <div className="flex flex-col gap-1 text-sm" data-testid="proof-delta">
        <span className="text-xs text-muted-foreground uppercase">What it learned in between</span>
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

const CHART: Record<LearningSeries["metric"], { title: string; format: (v: number) => string }> = {
  noise_rate: { title: "Noise rate", format: (v) => `${Math.round(v * 100)}%` },
  cost_per_useful: { title: "Cost per useful answer", format: (v) => `${v.toFixed(3)} USDC` },
  memory_hit_rate: { title: "Answered from memory", format: (v) => `${Math.round(v * 100)}%` },
};
const config = { value: { label: "Value", color: "var(--chart-1)" } } satisfies ChartConfig;
const dataPoints = (n: number) => `${n} data point${n === 1 ? "" : "s"}`;

function SeriesChart({ s }: { s: LearningSeries }) {
  const meta = CHART[s.metric];
  const points = s.points.filter((p) => p.value !== null);
  const last = points.at(-1);
  return (
    <div
      className="flex min-w-0 flex-col gap-2 rounded-xl border p-3"
      data-testid="learning-series"
      data-metric={s.metric}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{meta.title}</span>
        <span className="text-sm tabular-nums" data-testid="learning-latest">
          {last?.value != null ? meta.format(last.value) : "—"}
        </span>
      </div>
      {points.length ? (
        <ChartContainer config={config} className="h-32 w-full">
          <LineChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              fontSize={11}
              tickFormatter={(v: number) => meta.format(v)}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={2} dot />
          </LineChart>
        </ChartContainer>
      ) : (
        <p className="py-6 text-center text-xs text-muted-foreground">No data yet.</p>
      )}
      <span className="text-xs text-muted-foreground">
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
        description="From its own receipts and your 👍/👎. A day without data has no point."
      >
        {learning.error ? <p className="text-sm text-destructive">{learning.error}</p> : null}
        {!learning.data && !learning.error ? <Skeleton className="h-40 w-full" /> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {(learning.data?.series ?? []).map((s) => (
            <SeriesChart key={s.metric} s={s} />
          ))}
        </div>
      </Section>
      <Section
        title="Proof of Learning"
        description="The same kind of input, a different decision, and the memory that made the difference."
      >
        {proofs.error ? <p className="text-sm text-destructive">{proofs.error}</p> : null}
        {proofs.data && !proofs.data.proofs.length ? (
          <p className="text-sm text-muted-foreground">
            Nothing to show yet: a proof appears once it decides differently on the same kind of
            input after learning something (for a Sentinel, mark a ping 👎 noise).
          </p>
        ) : null}
        <ul className="flex max-w-3xl flex-col gap-4">
          {(proofs.data?.proofs ?? []).map((p) => (
            <li key={p.after.receiptId} className="rounded-xl border p-4">
              <ProofView proof={p} />
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
