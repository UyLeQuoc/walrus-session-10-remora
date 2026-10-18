export const TEAM_FACT_LENGTH = { min: 3, max: 1000 } as const;

export function teamFactText(raw: string): string | null {
  const text = raw.trim();
  if (text.length < TEAM_FACT_LENGTH.min || text.length > TEAM_FACT_LENGTH.max) return null;
  return text;
}
