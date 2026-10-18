export const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_LENGTH = 6;

const INVITE_PATTERN = new RegExp(`^[${INVITE_ALPHABET}]{${INVITE_LENGTH}}$`);
const JOIN_COMMAND = /^\/team\s+join\s+/i;

export function normalizeInviteCode(input: string): string {
  return input.trim().replace(JOIN_COMMAND, "").toUpperCase().replace(/[\s-]/g, "");
}

export function isInviteCode(code: string): boolean {
  return INVITE_PATTERN.test(code);
}

export function joinCommand(code: string): string {
  return `/team join ${code}`;
}
