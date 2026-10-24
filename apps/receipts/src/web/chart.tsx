import type { CurvePoint } from "../scoring.ts";

/** Mean Brier so far, per resolved market: lower is better. Inline SVG, no client code. */
export function Curve(props: { points: CurvePoint[]; title: string }) {
  const pts = props.points;
  if (pts.length < 2) return <p class="muted">Not enough resolved markets for a curve yet.</p>;
  const W = 640;
  const H = 240;
  const pad = 36;
  const ys = pts.flatMap((p) => [p.weighted, p.average, ...(p.books === null ? [] : [p.books])]);
  const lo = Math.max(0, Math.min(...ys) - 0.01);
  const hi = Math.max(...ys) + 0.01;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - lo) / (hi - lo)) * (H - pad * 2);
  const line = (pick: (p: CurvePoint) => number | null) =>
    pts
      .map((p, i) => [i, pick(p)] as const)
      .filter((d): d is readonly [number, number] => d[1] !== null)
      .map(([i, v]) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join(" ");
  const last = pts.at(-1) as CurvePoint;
  return (
    <figure style="margin:0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={props.title}>
        <rect x="0" y="0" width={W} height={H} fill="none" />
        {[lo, (lo + hi) / 2, hi].map((v) => (
          <g>
            <line
              x1={pad}
              x2={W - pad}
              y1={y(v)}
              y2={y(v)}
              stroke="currentColor"
              stroke-opacity="0.15"
            />
            <text x="2" y={y(v) + 4} font-size="11" fill="currentColor" fill-opacity="0.6">
              {v.toFixed(3)}
            </text>
          </g>
        ))}
        <polyline points={line((p) => p.books)} fill="none" stroke="#7aa2f7" stroke-width="2" />
        <polyline
          points={line((p) => p.average)}
          fill="none"
          stroke="#9aa3b2"
          stroke-width="2"
          stroke-dasharray="5 4"
        />
        <polyline points={line((p) => p.weighted)} fill="none" stroke="#f5c451" stroke-width="3" />
        <text
          x={W - pad}
          y={H - 8}
          font-size="11"
          text-anchor="end"
          fill="currentColor"
          fill-opacity="0.6"
        >
          {pts.length} resolved markets →
        </text>
      </svg>
      <figcaption class="muted">
        Mean Brier so far (lower is better).{" "}
        <span style="color:#f5c451">■ Receipts' weighted call {last.weighted.toFixed(3)}</span> ·{" "}
        <span>■ plain average {last.average.toFixed(3)}</span> ·{" "}
        <span style="color:#7aa2f7">
          ■ books {last.books === null ? "–" : last.books.toFixed(3)}
        </span>
        . Each call uses only weights learned from earlier results.
      </figcaption>
    </figure>
  );
}
