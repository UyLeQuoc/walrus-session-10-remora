export const TEAM_NAME_LENGTH = { min: 2, max: 48 } as const;
export const TEAM_FACT_LENGTH = { min: 3, max: 1000 } as const;

export function isTeamName(name: string): boolean {
  const length = name.trim().length;
  return length >= TEAM_NAME_LENGTH.min && length <= TEAM_NAME_LENGTH.max;
}

export function factLength(text: string): number {
  return text.trim().length;
}

export function isTeamFact(text: string): boolean {
  const length = factLength(text);
  return length >= TEAM_FACT_LENGTH.min && length <= TEAM_FACT_LENGTH.max;
}
