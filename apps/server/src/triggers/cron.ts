/**
 * D1 cron + N12 human schedules. Five-field cron ("m h dom mon dow") with numbers, `*`, lists and
 * steps, evaluated in UTC; each run is a D2 job (`remora.cron`) that enqueues the next one.
 */
const field = (spec: string, min: number, max: number): Set<number> => {
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const [range, stepS] = part.split("/");
    const step = stepS ? Number(stepS) : 1;
    const [a, b] =
      range === "*" || range === undefined
        ? [min, max]
        : range.includes("-")
          ? range.split("-").map(Number)
          : [Number(range), Number(range)];
    for (let v = a ?? min; v <= (b ?? max); v += step) if (v >= min && v <= max) out.add(v);
  }
  return out;
};

/** The next time strictly after `from` that matches `expr` (UTC), or null for an invalid expression. */
export function nextRun(expr: string, from: Date): Date | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [m, h, dom, mon, dow] = parts as [string, string, string, string, string];
  const sets = [
    field(m, 0, 59),
    field(h, 0, 23),
    field(dom, 1, 31),
    field(mon, 1, 12),
    field(dow, 0, 6),
  ] as const;
  if (sets.some((s) => s.size === 0)) return null;
  const t = new Date(from.getTime());
  t.setUTCSeconds(0, 0);
  t.setUTCMinutes(t.getUTCMinutes() + 1);
  for (let i = 0; i < 366 * 24 * 60; i++) {
    if (
      sets[3].has(t.getUTCMonth() + 1) &&
      sets[2].has(t.getUTCDate()) &&
      sets[4].has(t.getUTCDay()) &&
      sets[1].has(t.getUTCHours()) &&
      sets[0].has(t.getUTCMinutes())
    ) {
      return t;
    }
    t.setUTCMinutes(t.getUTCMinutes() + 1);
  }
  return null;
}

/** N12: "every Monday 9am"-style text for a cron expression (falls back to the expression). */
export function human(expr: string): string {
  const p = expr.trim().split(/\s+/);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  if (p.length !== 5) return expr;
  const [m, h, dom, mon, dow] = p;
  if (!/^\d+$/.test(m ?? "") || !/^\d+$/.test(h ?? "") || dom !== "*" || mon !== "*") return expr;
  const time = `${Number(h) % 12 || 12}${Number(m) ? `:${String(m).padStart(2, "0")}` : ""}${Number(h) < 12 ? "am" : "pm"} UTC`;
  if (dow === "*") return `every day at ${time}`;
  if (/^\d$/.test(dow ?? "")) return `every ${days[Number(dow)]} at ${time}`;
  return expr;
}
