/**
 * N11 (ADR-0122): a config value as a short line for the History diff. Values come straight from the
 * stored config, so each one is read defensively.
 */
import type { ConfigFieldDiff } from "@remora/schema";
import { modelById } from "@/features/chat/models";
import { payeeName } from "@/lib/payee";
import { usdc } from "@/lib/usdc";

const AMOUNT = /^\d+$/;
const short = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

function trigger(t: unknown): string {
  const x = (t ?? {}) as Record<string, unknown>;
  switch (x.kind) {
    case "message":
      return "Messages";
    case "cron":
      return String(x.human ?? x.cron ?? "A schedule");
    case "chain": {
      const addresses = Array.isArray(x.addresses) ? x.addresses.map(String) : [];
      return addresses.length <= 2
        ? `Watches ${addresses.map(short).join(", ") || "nothing"}`
        : `Watches ${plural(addresses.length, "wallet")}`;
    }
    case "price":
      return `${String(x.symbol ?? "A price")} ${x.above !== undefined ? `above ${x.above}` : ""}${x.below !== undefined ? ` below ${x.below}` : ""}`.trim();
    case "webhook":
      return "A webhook";
    default:
      return "A trigger";
  }
}

/** "—" for a field that wasn't set. */
export function valueLine(field: ConfigFieldDiff["field"], v: unknown): string {
  if (v === undefined || v === null) return field === "model" ? "Default" : "—";
  if (field === "model" && typeof v === "string") return modelById(v).label;
  if (field === "budget" && typeof v === "object") {
    const b = v as { windowLimit?: string; window?: string; perPaymentCap?: string };
    if (AMOUNT.test(b.windowLimit ?? "") && AMOUNT.test(b.perPaymentCap ?? ""))
      return `${usdc(b.windowLimit ?? "0")} USDC a ${b.window ?? "month"}, ${usdc(b.perPaymentCap ?? "0")} a payment`;
  }
  if (field === "payees" && Array.isArray(v))
    return v.length ? v.map((p) => payeeName(String(p))).join(", ") : "None";
  if (field === "triggers" && Array.isArray(v)) return v.map(trigger).join(" · ");
  if (field === "sell" && typeof v === "object") {
    const s = v as { on?: boolean; slug?: string; price?: string };
    const price = AMOUNT.test(s.price ?? "") ? ` · ${usdc(s.price ?? "0")} USDC` : "";
    return s.on ? `On sale as @${s.slug}${price}` : `Not on sale (@${s.slug})`;
  }
  if (field === "schedules" && Array.isArray(v))
    return v.length
      ? v.map((s) => String((s as { human?: string }).human ?? "A schedule")).join(" · ")
      : "None";
  if (field === "items" && Array.isArray(v)) return v.map(String).join(", ");
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return plural(v.length, "item");
  return JSON.stringify(v).slice(0, 80);
}

/** What a restore does with the fields it would change, in one line. */
export function restorePlan(changes: ConfigFieldDiff[]): string {
  const now = changes.filter((c) => c.restore === "direct").map((c) => c.label);
  const sign = changes.filter((c) => c.restore === "signature").map((c) => c.label);
  const not = changes.filter((c) => c.restore === "none").map((c) => c.label);
  return [
    now.length ? `${now.join(", ")} change${now.length === 1 ? "s" : ""} now.` : "",
    sign.length ? `${sign.join(" and ")}: you sign one transaction.` : "",
    not.length ? `${not.join(", ")} stay as they are.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
