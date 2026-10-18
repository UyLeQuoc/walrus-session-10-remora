import { Hono } from "hono";
import { z } from "zod";
import { checkRate, noteCommand } from "../chat/ratelimit.ts";
import { teamFactSentence } from "../identity/team-copy.ts";
import { createTeam, currentTeam, inviteToTeam, joinTeam, leaveTeam } from "../identity/teams.ts";
import { rememberTeamFact, searchTeam, teamOverview } from "../memory/team-person.ts";
import { mePerson } from "./chat.ts";
import { createRefusal, joinRefusal, teamFactRefusal, teamSearchRefusal } from "./team-reply.ts";

const CHANNEL = "web";

const createBody = z.object({ name: z.string() });
const joinBody = z.object({ code: z.string() });
const rememberBody = z.object({ text: z.string() });
const searchQuery = z.string().trim().catch("");

export const teamRoutes = new Hono()
  .get("/api/me/team", async (c) => {
    const person = await mePerson(c);
    if (!person) return c.json({ team: null, known: false });
    return c.json({ known: true, team: await teamOverview(person) });
  })
  .post("/api/me/team", async (c) => {
    const person = await mePerson(c);
    if (!person) return c.json({ error: "Say something first." }, 401);
    const parsed = createBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      const refusal = createRefusal("bad-name");
      return c.json({ error: refusal.error }, refusal.status);
    }
    const gate = await checkRate(person.id);
    if (!gate.allowed) return c.json({ error: gate.message }, 429);
    await noteCommand(person.id, CHANNEL);
    const outcome = await createTeam(person, parsed.data.name);
    if (!outcome.ok) {
      const refusal = createRefusal(outcome.reason);
      return c.json({ error: refusal.error }, refusal.status);
    }
    return c.json({
      team: { name: outcome.team.name, memberCount: outcome.team.memberCount },
      invite: { code: outcome.code, expiresInMinutes: outcome.expiresInMinutes },
    });
  })
  .post("/api/me/team/join", async (c) => {
    const person = await mePerson(c);
    if (!person) return c.json({ error: "Say something first." }, 401);
    const parsed = joinBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      const refusal = joinRefusal("unknown");
      return c.json({ error: refusal.error }, refusal.status);
    }
    const gate = await checkRate(person.id);
    if (!gate.allowed) return c.json({ error: gate.message }, 429);
    await noteCommand(person.id, CHANNEL);
    const outcome = await joinTeam(person, parsed.data.code);
    if (!outcome.ok) {
      const refusal = joinRefusal(outcome.reason);
      return c.json({ error: refusal.error }, refusal.status);
    }
    return c.json({
      team: { name: outcome.team.name, memberCount: outcome.team.memberCount },
    });
  })
  .post("/api/me/team/remember", async (c) => {
    const person = await mePerson(c);
    if (!person) return c.json({ error: "Say something first." }, 401);
    const parsed = rememberBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      const refusal = teamFactRefusal("text");
      return c.json({ error: refusal.error }, refusal.status);
    }
    const gate = await checkRate(person.id);
    if (!gate.allowed) return c.json({ error: gate.message }, 429);
    await noteCommand(person.id, CHANNEL);
    const outcome = await rememberTeamFact({
      person,
      channel: CHANNEL,
      text: parsed.data.text,
    }).catch((err) => {
      console.error("[team] remember failed", err instanceof Error ? err.name : "error");
      return null;
    });
    if (!outcome) return c.json({ error: "Could not add that to the team. Try again." }, 502);
    if (!outcome.ok) {
      const refusal = teamFactRefusal(outcome.reason);
      return c.json({ error: refusal.error }, refusal.status);
    }
    return c.json({
      saved: outcome.saved,
      redacted: outcome.redacted,
      message: teamFactSentence(outcome),
    });
  })
  .get("/api/me/team/search", async (c) => {
    const query = searchQuery.parse(c.req.query("q"));
    if (!query) return c.json({ results: [] });
    const person = await mePerson(c);
    if (!person) return c.json({ results: [] });
    const gate = await checkRate(person.id);
    if (!gate.allowed) return c.json({ error: gate.message }, 429);
    await noteCommand(person.id, CHANNEL);
    const found = await searchTeam(person, CHANNEL, query);
    if (!found.ok) {
      const refusal = teamSearchRefusal(found.reason);
      return c.json({ error: refusal.error }, refusal.status);
    }
    return c.json({ results: found.results });
  })
  .post("/api/me/team/invite", async (c) => {
    const person = await mePerson(c);
    if (!person) return c.json({ error: "Say something first." }, 401);
    const gate = await checkRate(person.id);
    if (!gate.allowed) return c.json({ error: gate.message }, 429);
    await noteCommand(person.id, CHANNEL);
    const team = await currentTeam(person.id);
    if (!team) return c.json({ error: "You are not in a team." }, 409);
    return c.json(await inviteToTeam(person, team.teamId));
  })
  .post("/api/me/team/leave", async (c) => {
    const person = await mePerson(c);
    if (!person) return c.json({ error: "Say something first." }, 401);
    const gate = await checkRate(person.id);
    if (!gate.allowed) return c.json({ error: gate.message }, 429);
    await noteCommand(person.id, CHANNEL);
    const left = await leaveTeam(person.id);
    if (!left) return c.json({ error: "You are not in a team." }, 409);
    return c.json({ left: left.name });
  });
