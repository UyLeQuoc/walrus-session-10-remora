/** One sentence for a remora's configured budget, shared by its card and its page. */
import type { RemoraView } from "@remora/schema";
import { usdc } from "@/lib/usdc";

export function budgetLine(r: RemoraView): string {
  const b = r.config.budget;
  if (!b) return "Read-only: no budget";
  return `Up to ${usdc(b.windowLimit)} USDC a ${b.window}, at most ${usdc(b.perPaymentCap)} a payment`;
}
