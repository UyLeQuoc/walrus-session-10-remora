import type { CreateOutcome, JoinOutcome } from "./teams.ts";

export type CreateRefusal = Extract<CreateOutcome, { ok: false }>["reason"];
export type JoinRefusal = Extract<JoinOutcome, { ok: false }>["reason"];
export type TeamFactRefusal = "not-in-a-team" | "text";

const ALREADY_IN_A_TEAM = "You are already in a team. Leave it first (/team leave).";

export function createRefusalSentence(reason: CreateRefusal): string {
  switch (reason) {
    case "bad-name":
      return "Give the team a name of at least two characters (/team new Platform).";
    case "already-in-a-team":
      return ALREADY_IN_A_TEAM;
    default: {
      const unexpected: never = reason;
      return unexpected;
    }
  }
}

export function joinRefusalSentence(reason: JoinRefusal): string {
  switch (reason) {
    case "unknown":
      return "That is not a code. They look like ABC234.";
    case "expired":
      return "That code has been used or has expired. Ask for another.";
    case "already-in-a-team":
      return ALREADY_IN_A_TEAM;
    case "already-member":
      return "You are already in that team.";
    case "full":
      return "That team is full.";
    default: {
      const unexpected: never = reason;
      return unexpected;
    }
  }
}

export function joinedSentence(teamName: string): string {
  return `Joined "${teamName}". You will now recall what the team has put in, and /team remember adds to it.\n\nYour own memory stays yours and is not shared.`;
}

export function teamFactRefusalSentence(reason: TeamFactRefusal): string {
  switch (reason) {
    case "not-in-a-team":
      return "You are not in a team. Start one or join one first (/team new, /team join).";
    case "text":
      return "Write the fact in 3 to 1000 characters (/team remember <fact>).";
    default: {
      const unexpected: never = reason;
      return unexpected;
    }
  }
}

export function teamFactSentence(input: {
  saved: boolean;
  redacted: readonly string[];
  teamName: string;
}): string {
  if (!input.saved) return `"${input.teamName}" already knows that.`;
  const redacted = input.redacted.length
    ? ` I stripped ${input.redacted.join(", ")} out of it first.`
    : "";
  return `Added to "${input.teamName}". Everyone in the team can recall it from now on.${redacted}`;
}
