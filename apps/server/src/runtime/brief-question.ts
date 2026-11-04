/**
 * ADR-0106: the Briefer's one question, built from its owner's list in words `planBuys` reads. Pure,
 * so the schedule runtime and the Briefer share it without importing each other.
 */

export const BRIEF_WHEN = "weekdays at 8am";
export const MAX_ITEMS = 6;

const TOKENS =
  /^(?:SUI|WAL|WALRUS|BTC|BITCOIN|ETH|ETHER|ETHEREUM)(?:\s*(?:,|and|&)\s*(?:SUI|WAL|WALRUS|BTC|BITCOIN|ETH|ETHER|ETHEREUM))*(?:\s+prices?)?$/i;

/**
 * One item in the words `planBuys` reads: a bare address becomes a wallet X-ray, a bare repo a
 * GitHub link, a list of tokens their prices, "Hanoi weather" the weather in Hanoi. Anything else
 * stays as its owner wrote it.
 */
export function briefItem(raw: string): string {
  const item = raw.trim().replace(/[.?!]+$/, "");
  if (/^0x[0-9a-fA-F]{64}$/.test(item)) return `what does wallet ${item} hold`;
  const repo = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+\/[\w.-]+)$/i.exec(item);
  if (repo) return `how healthy is https://github.com/${repo[1]}`;
  if (TOKENS.test(item)) return `what are ${item.replace(/\s+prices?$/i, "")} worth`;
  const weather =
    /^(?:weather|forecast|rain)\s+(?:in|for)?\s*(.+)$/i.exec(item) ??
    /^(.+?)\s+(?:weather|forecast)$/i.exec(item);
  if (weather?.[1]) {
    const city = weather[1].replace(/\b\p{Ll}/gu, (c) => c.toUpperCase());
    return `the weather in ${city}`;
  }
  return item;
}

/**
 * The brief's one question. It never says "brief": `planBuys` would read that word as a request to
 * buy a Brief of the question itself.
 */
export function briefQuestion(items: string[]): string {
  return `Today's update, one line each: ${items.map(briefItem).join("; ")}.`;
}
