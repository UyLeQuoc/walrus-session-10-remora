/** ADR-0094: a service a remora pays, shown by its name rather than its `reef:` id. */
const NAMES: Record<string, string> = {
  "reef:sui-risk": "Sui risk check",
  "reef:odds": "Odds",
  "reef:brief": "Brief",
};

export function payeeName(ref: string): string {
  return NAMES[ref] ?? ref.replace(/^reef:/, "");
}
