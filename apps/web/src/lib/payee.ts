/** ADR-0094: a service a remora pays, shown by its name rather than its `reef:` id. */
const NAMES: Record<string, string> = {
  "reef:sui-risk": "Sui risk check",
  "reef:odds": "Odds",
  "reef:brief": "Brief",
  "reef:wallet": "Wallet X-ray",
  "reef:walrus": "Walrus blob check",
  "reef:github": "Repo health",
  "reef:price": "Prices",
  "reef:weather": "Weather",
  "reef:market": "Market data",
};

export function payeeName(ref: string): string {
  // ADR-0111/0113: a remora on sale or a listed API is `reef:remora-<slug>` or
  // `reef:community-<slug>`, shown as "@<slug>".
  const listed = /^reef:(?:remora|community)-(.+)$/.exec(ref);
  if (listed) return `@${listed[1]}`;
  return NAMES[ref] ?? ref.replace(/^reef:/, "");
}
