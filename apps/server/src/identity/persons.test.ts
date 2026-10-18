import { loadEnv, withoutBlanks } from "@remora/memory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serverEnvSchema } from "../env/schema.ts";

loadEnv();

const live = serverEnvSchema.safeParse(withoutBlanks(process.env)).success;
const CHANNEL = "test-race";

describe.skipIf(!live)("resolvePerson (Postgres)", () => {
  let persons: typeof import("./persons.ts");
  let schema: typeof import("@remora/db");
  let context: typeof import("../context.ts");
  const created = new Set<string>();

  beforeAll(async () => {
    persons = await import("./persons.ts");
    schema = await import("@remora/db");
    context = await import("../context.ts");
  });

  afterAll(async () => {
    for (const id of created) {
      await context.db.delete(schema.people).where(schema.eq(schema.people.id, id));
    }
  });

  it("gives concurrent first requests for one new identity the same person", async () => {
    const externalId = crypto.randomUUID();
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => persons.resolvePerson(CHANNEL, externalId, CHANNEL)),
    );
    for (const r of results) if (r.status === "fulfilled") created.add(r.value.id);
    expect(results.map((r) => r.status)).toEqual(Array(6).fill("fulfilled"));
    expect(created.size).toBe(1);

    const identities = await context.db
      .select({ personId: schema.channelIdentities.personId })
      .from(schema.channelIdentities)
      .where(
        schema.and(
          schema.eq(schema.channelIdentities.channel, CHANNEL),
          schema.eq(schema.channelIdentities.externalId, externalId),
        ),
      );
    expect(identities).toHaveLength(1);
  });
});
