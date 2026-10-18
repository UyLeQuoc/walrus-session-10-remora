export const GETTING_TO_KNOW = { facts: 3, turns: 6 } as const;

export function isGettingToKnow(known: { facts: number; turns: number }): boolean {
  return known.facts < GETTING_TO_KNOW.facts && known.turns < GETTING_TO_KNOW.turns;
}
