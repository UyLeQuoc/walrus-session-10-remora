/**
 * ADR-0101: a remora's kind in plain words. The templates stay `scout` and `sentinel` in code, the
 * API and the docs; people read "Researcher" and "Wallet watcher".
 */
const NAMES: Record<string, string> = {
  scout: "Researcher",
  sentinel: "Wallet watcher",
  // ADR-0106: the third kind.
  briefer: "Briefer",
};

export function kindName(template: string): string {
  return NAMES[template] ?? template.slice(0, 1).toUpperCase() + template.slice(1);
}
