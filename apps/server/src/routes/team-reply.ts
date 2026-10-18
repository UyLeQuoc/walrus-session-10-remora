import {
  type CreateRefusal,
  createRefusalSentence,
  type JoinRefusal,
  joinRefusalSentence,
  type TeamFactRefusal,
  teamFactRefusalSentence,
} from "../identity/team-copy.ts";
import type { TeamSearchRefusal } from "../memory/team-person.ts";

export interface TeamRefusal {
  status: 400 | 404 | 409 | 502;
  error: string;
}

export function createRefusal(reason: CreateRefusal): TeamRefusal {
  const error = createRefusalSentence(reason);
  switch (reason) {
    case "bad-name":
      return { status: 400, error };
    case "already-in-a-team":
      return { status: 409, error };
    default: {
      const unexpected: never = reason;
      return unexpected;
    }
  }
}

export function joinRefusal(reason: JoinRefusal): TeamRefusal {
  const error = joinRefusalSentence(reason);
  switch (reason) {
    case "unknown":
      return { status: 400, error };
    case "expired":
      return { status: 404, error };
    case "already-in-a-team":
    case "already-member":
    case "full":
      return { status: 409, error };
    default: {
      const unexpected: never = reason;
      return unexpected;
    }
  }
}

export function teamFactRefusal(reason: TeamFactRefusal): TeamRefusal {
  const error = teamFactRefusalSentence(reason);
  switch (reason) {
    case "text":
      return { status: 400, error };
    case "not-in-a-team":
      return { status: 409, error };
    default: {
      const unexpected: never = reason;
      return unexpected;
    }
  }
}

export function teamSearchRefusal(reason: TeamSearchRefusal): TeamRefusal {
  switch (reason) {
    case "unreachable":
      return { status: 502, error: "Walrus Memory could not be reached just now." };
    case "not-in-a-team":
      return teamFactRefusal(reason);
    default: {
      const unexpected: never = reason;
      return unexpected;
    }
  }
}
