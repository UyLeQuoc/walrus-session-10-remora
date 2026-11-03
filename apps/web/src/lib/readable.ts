/**
 * Agent text as people read it (ADR-0103): without the `<untrusted source="…">` wrappers a model
 * sometimes copies from the tool output it quoted, and without runs of blank lines.
 */
export const readable = (text: string) =>
  text
    .replace(/<\/?untrusted[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/**
 * Event text in the app's units (ADR-0103): the server writes "Didn't pay 20000 to Odds" in USDC's
 * smallest unit and names services by ref ("reef:odds"). Reads "Didn't pay 0.02 USDC to Odds".
 */
export function plainEvent(text: string, name: (ref: string) => string): string {
  return text
    .replace(/\b(pay|paid|approve|Pay) (\d{4,}) to\b/g, (_m, verb: string, units: string) => {
      const n = BigInt(units);
      const whole = n / 1_000_000n;
      const frac = (n % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "").padEnd(2, "0");
      return `${verb} ${whole}.${frac} USDC to`;
    })
    .replace(/\breef:[a-z0-9-]+/g, (ref) => name(ref));
}
