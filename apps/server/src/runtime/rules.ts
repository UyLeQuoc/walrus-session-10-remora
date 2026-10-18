/**
 * C2/F2: Sentinel's escalation rules. The owner says them in free text; they become a small structured
 * rule that triage evaluates deterministically, newest first. A phrase parser handles the common forms;
 * anything else goes to the model (structured output) and is shown back before it's saved.
 */
import { z } from "zod";

export const SentinelRule = z.object({
  action: z.enum(["ignore", "ping"]),
  when: z.object({
    direction: z.enum(["in", "out"]).optional(),
    /** Symbol (SUI, USDC) or a full coin type. */
    coin: z.string().optional(),
    /** Amount in whole units (e.g. 0.01 SUI). */
    under: z.number().positive().optional(),
    over: z.number().positive().optional(),
  }),
});
export type SentinelRule = z.infer<typeof SentinelRule>;

export interface ChainEvent {
  address: string;
  direction: "in" | "out";
  coinType: string;
  /** Smallest units, absolute value. */
  amount: bigint;
  decimals: number;
  digest: string;
}

const symbolOf = (coinType: string) => coinType.split("::").pop()?.toUpperCase() ?? coinType;

/** "ignore incoming SUI under 0.01", "always ping me for anything over 1 SUI", "mute outgoing USDC below 5". */
export function parseRule(text: string): SentinelRule | null {
  const t = text.toLowerCase();
  const action = /\b(ignore|mute|skip|don'?t (ping|notify|wake))\b/.test(t)
    ? "ignore"
    : /\b(ping|notify|wake|alert|tell)\b/.test(t)
      ? "ping"
      : null;
  if (!action) return null;
  const direction = /\b(incoming|received|inbound|deposits?)\b/.test(t)
    ? "in"
    : /\b(outgoing|sent|outbound|withdrawals?)\b/.test(t)
      ? "out"
      : undefined;
  const coin = /\bsui\b/.test(t) ? "SUI" : /\busdc\b/.test(t) ? "USDC" : undefined;
  const num = (re: RegExp) => {
    const m = re.exec(t);
    return m?.[1] ? Number(m[1]) : undefined;
  };
  const under = num(/\b(?:under|below|less than|<)\s*\$?([\d.]+)/);
  const over = num(/\b(?:over|above|more than|>)\s*\$?([\d.]+)/);
  if (under === undefined && over === undefined && !direction && !coin) return null;
  return SentinelRule.parse({
    action,
    when: {
      ...(direction ? { direction } : {}),
      ...(coin ? { coin } : {}),
      ...(under !== undefined ? { under } : {}),
      ...(over !== undefined ? { over } : {}),
    },
  });
}

export function matches(rule: SentinelRule, e: ChainEvent): boolean {
  const w = rule.when;
  if (w.direction && w.direction !== e.direction) return false;
  if (w.coin && w.coin.toUpperCase() !== symbolOf(e.coinType) && w.coin !== e.coinType)
    return false;
  const units = Number(e.amount) / 10 ** e.decimals;
  if (w.under !== undefined && !(units < w.under)) return false;
  if (w.over !== undefined && !(units > w.over)) return false;
  return true;
}

/** Newest rule that matches decides; with none, Sentinel pings. */
export function triage(rules: { rule: SentinelRule; text: string }[], e: ChainEvent) {
  const hit = rules.find((r) => matches(r.rule, e));
  return hit
    ? {
        verdict: hit.rule.action === "ignore" ? ("noise" as const) : ("ping" as const),
        because: hit.text,
      }
    : { verdict: "ping" as const, because: null };
}

export function describeEvent(e: ChainEvent): string {
  const units = Number(e.amount) / 10 ** e.decimals;
  return `${e.direction === "in" ? "Received" : "Sent"} ${units} ${symbolOf(e.coinType)} (${e.digest.slice(0, 8)}…)`;
}
