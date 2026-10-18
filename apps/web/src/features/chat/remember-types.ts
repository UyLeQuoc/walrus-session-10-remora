export const REMEMBER_TYPES = [
  "profile",
  "decision",
  "gotcha",
  "commitment",
  "correction",
  "style",
] as const;

export type RememberType = (typeof REMEMBER_TYPES)[number];

export function isRememberType(value: string): value is RememberType {
  return (REMEMBER_TYPES as readonly string[]).includes(value);
}
