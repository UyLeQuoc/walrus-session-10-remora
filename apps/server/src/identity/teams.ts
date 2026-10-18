/**
 * Shared memory for a few people.
 *
 * Three decisions shape this, and each one is a choice about whose memory it is.
 *
 * **Writes are explicit.** Joining a team must never turn your ordinary
 * conversation into something colleagues can read. Personal memory stays
 * personal; a fact reaches the team only when somebody runs `/team remember`.
 * The opposite default would be a privacy incident waiting for its first user.
 *
 * **Reads are automatic.** Once you are in, team memory is recalled alongside
 * your own, through the same read-only companion scope that keeps guest
 * memories reachable after `/connect`.
 *
 * **Leaving is not erasing.** You stop reading and writing. What you already
 * contributed stays, because a memory on Walrus cannot be deleted
 * (docs/issues/09). `/team leave` says that rather than implying a clean exit.
 */
import { randomInt } from "node:crypto";
import { and, eq, gt, isNull, sql, teamInvites, teamMembers, teams } from "@remora/db";
import { db } from "../context.ts";
import type { Person } from "./persons.ts";

const INVITE_TTL_MS = 10 * 60 * 1000;
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I, L, O, 0, 1
const MAX_MEMBERS = 12;
const MAX_NAME = 48;

function makeCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export interface TeamMembership {
  teamId: string;
  name: string;
  memberCount: number;
}

/** The team this person is currently in, if any. One at a time, for now. */
export async function currentTeam(personId: string): Promise<TeamMembership | null> {
  const [row] = await db
    .select({
      teamId: teams.id,
      name: teams.name,
      memberCount: sql<number>`(
        select count(*)::int from team_members m
        where m.team_id = ${teams.id} and m.left_at is null
      )`,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(eq(teamMembers.personId, personId), isNull(teamMembers.leftAt)))
    .limit(1);
  return row ?? null;
}

export type CreateOutcome =
  | { ok: true; team: TeamMembership; code: string; expiresInMinutes: number }
  | { ok: false; reason: "already-in-a-team" | "bad-name" };

export async function createTeam(person: Person, rawName: string): Promise<CreateOutcome> {
  const name = rawName.trim().slice(0, MAX_NAME);
  if (name.length < 2) return { ok: false, reason: "bad-name" };
  if (await currentTeam(person.id)) return { ok: false, reason: "already-in-a-team" };

  const [team] = await db.insert(teams).values({ name, createdBy: person.id }).returning();
  if (!team) throw new Error("team insert returned nothing");
  await db.insert(teamMembers).values({ teamId: team.id, personId: person.id });
  const invite = await inviteToTeam(person, team.id);
  return {
    ok: true,
    team: { teamId: team.id, name: team.name, memberCount: 1 },
    code: invite.code,
    expiresInMinutes: invite.expiresInMinutes,
  };
}

export async function inviteToTeam(
  person: Person,
  teamId: string,
): Promise<{ code: string; expiresInMinutes: number }> {
  const code = makeCode();
  await db.insert(teamInvites).values({
    code,
    teamId,
    createdBy: person.id,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });
  return { code, expiresInMinutes: Math.round(INVITE_TTL_MS / 60_000) };
}

export type JoinOutcome =
  | { ok: true; team: TeamMembership }
  | { ok: false; reason: "unknown" | "expired" | "already-in-a-team" | "full" | "already-member" };

export async function joinTeam(person: Person, rawCode: string): Promise<JoinOutcome> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(code)) return { ok: false, reason: "unknown" };

  const [invite] = await db
    .select()
    .from(teamInvites)
    .where(
      and(
        eq(teamInvites.code, code),
        isNull(teamInvites.usedAt),
        gt(teamInvites.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!invite) return { ok: false, reason: "expired" };

  const existing = await currentTeam(person.id);
  if (existing) {
    return {
      ok: false,
      reason: existing.teamId === invite.teamId ? "already-member" : "already-in-a-team",
    };
  }

  const [count] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, invite.teamId), isNull(teamMembers.leftAt)));
  if ((count?.n ?? 0) >= MAX_MEMBERS) return { ok: false, reason: "full" };

  await db.transaction(async (tx) => {
    // A row may already exist from an earlier stay; rejoining clears left_at
    // rather than inserting a second one, which the unique index forbids.
    await tx
      .insert(teamMembers)
      .values({ teamId: invite.teamId, personId: person.id })
      .onConflictDoUpdate({
        target: [teamMembers.teamId, teamMembers.personId],
        set: { leftAt: null, joinedAt: new Date() },
      });
    await tx.update(teamInvites).set({ usedAt: new Date() }).where(eq(teamInvites.code, code));
  });

  const team = await currentTeam(person.id);
  return team ? { ok: true, team } : { ok: false, reason: "unknown" };
}

export async function leaveTeam(personId: string): Promise<TeamMembership | null> {
  const team = await currentTeam(personId);
  if (!team) return null;
  await db
    .update(teamMembers)
    .set({ leftAt: new Date() })
    .where(and(eq(teamMembers.personId, personId), isNull(teamMembers.leftAt)));
  return team;
}
