import { and, desc, eq, memoryIndex } from "@remora/db";
import { explorer, NAMESPACE } from "@remora/memory";
import { db } from "../context.ts";
import { type Person, teamPortFor } from "../identity/persons.ts";
import type { TeamFactRefusal } from "../identity/team-copy.ts";
import { currentTeam } from "../identity/teams.ts";
import { type SearchResult, searchResult } from "./search-result.ts";
import { teamFactText } from "./team.ts";
import type { WriteStatus } from "./write-status.ts";

export interface TeamMemory {
  id: string;
  type: string;
  status: WriteStatus;
  createdAt: Date;
  blobId: string | null;
  explorerUrl: string | null;
  mine: boolean;
}

export interface TeamOverview {
  name: string;
  memberCount: number;
  memories: TeamMemory[];
}

export async function teamOverview(person: Person): Promise<TeamOverview | null> {
  const team = await currentTeam(person.id);
  if (!team) return null;
  const rows = await db
    .select()
    .from(memoryIndex)
    .where(eq(memoryIndex.namespace, NAMESPACE.team(team.teamId)))
    .orderBy(desc(memoryIndex.createdAt))
    .limit(50);
  return {
    name: team.name,
    memberCount: team.memberCount,
    memories: rows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      createdAt: r.createdAt,
      blobId: r.blobId,
      explorerUrl: r.blobId ? explorer.blobExplorer(r.blobId) : null,
      mine: r.personId === person.id,
    })),
  };
}

export type TeamFactResult =
  | { ok: true; saved: boolean; redacted: string[]; teamName: string }
  | { ok: false; reason: TeamFactRefusal };

export async function rememberTeamFact(input: {
  person: Person;
  channel: string;
  text: string;
}): Promise<TeamFactResult> {
  const team = await currentTeam(input.person.id);
  if (!team) return { ok: false, reason: "not-in-a-team" };
  const text = teamFactText(input.text);
  if (!text) return { ok: false, reason: "text" };
  const port = await teamPortFor(input.person, input.channel, team.teamId);
  const result = await port.remember({ type: "decision", text, channel: input.channel });
  return { ok: true, saved: result.saved, redacted: result.redacted, teamName: team.name };
}

export type TeamSearchRefusal = "not-in-a-team" | "unreachable";

export type TeamSearchResult =
  | { ok: true; results: SearchResult[] }
  | { ok: false; reason: TeamSearchRefusal };

export async function searchTeam(
  person: Person,
  channel: string,
  query: string,
): Promise<TeamSearchResult> {
  const team = await currentTeam(person.id);
  if (!team) return { ok: false, reason: "not-in-a-team" };
  const port = await teamPortFor(person, channel, team.teamId);
  const hits = await port.recall({ query, limit: 8, maxDistance: 0.9 }).catch((err) => {
    console.error("[team] recall failed", err instanceof Error ? err.name : "error");
    return null;
  });
  if (hits === null) return { ok: false, reason: "unreachable" };
  const rows = await db
    .select({ blobId: memoryIndex.blobId })
    .from(memoryIndex)
    .where(
      and(
        eq(memoryIndex.namespace, NAMESPACE.team(team.teamId)),
        eq(memoryIndex.personId, person.id),
      ),
    );
  const mine = new Set(rows.flatMap((r) => (r.blobId ? [r.blobId] : [])));
  return { ok: true, results: hits.map((hit) => searchResult(hit, mine)) };
}
