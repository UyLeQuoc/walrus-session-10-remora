import { describe, expect, it } from "vitest";
import { countPeople, qualifyingPeople } from "./people-count.ts";

describe("countPeople", () => {
  it("counts a person once when guest and owned writes landed on different accounts", () => {
    const people = countPeople([
      {
        personId: "person-a",
        mode: "owned",
        accountId: "0xowned",
        stored: 6,
        pending: 1,
        failed: 0,
        first: "2026-09-29 10:00:00+00",
        last: "2026-09-30 10:00:00+00",
      },
      {
        personId: "person-a",
        mode: "owned",
        accountId: "0xoperator",
        stored: 5,
        pending: 0,
        failed: 1,
        first: "2026-09-22 10:00:00+00",
        last: "2026-09-28 10:00:00+00",
      },
      {
        personId: "person-b",
        mode: "guest",
        accountId: "0xoperator",
        stored: 10,
        pending: 0,
        failed: 0,
        first: "2026-09-29 11:00:00+00",
        last: "2026-09-29 12:00:00+00",
      },
    ]);
    expect(people).toHaveLength(2);
    expect(people.map((person) => person.personId)).toEqual(["person-a", "person-b"]);
    expect(people[0]).toMatchObject({
      stored: 11,
      pending: 1,
      failed: 1,
      mode: "owned",
      accountIds: ["0xowned", "0xoperator"],
      first: "2026-09-22 10:00:00+00",
      last: "2026-09-30 10:00:00+00",
    });
    expect(qualifyingPeople(people)).toEqual(people);
    expect(new Set(people.flatMap((person) => person.accountIds)).size).toBe(2);
  });

  it("does not let a 6 and 4 split qualify as ten until they are added", () => {
    const split = countPeople([
      {
        personId: "person-a",
        mode: "guest",
        accountId: "0xoperator",
        stored: 6,
        pending: 0,
        failed: 0,
        first: "2026-09-29",
        last: "2026-09-29",
      },
      {
        personId: "person-a",
        mode: "owned",
        accountId: "0xowned",
        stored: 4,
        pending: 0,
        failed: 0,
        first: "2026-09-30",
        last: "2026-09-30",
      },
    ]);
    expect(split[0]?.stored).toBe(10);
    expect(split[0]?.mode).toBe("owned");
    expect(qualifyingPeople(split)).toHaveLength(1);
  });

  it("does not count a guest as owned, and treats numeric strings as numbers", () => {
    const people = countPeople([
      {
        personId: "person-c",
        mode: "guest",
        accountId: "0xoperator",
        stored: "9",
        pending: "1",
        failed: "0",
        first: "2026-09-29",
        last: "2026-09-30",
      },
    ]);
    expect(people[0]).toMatchObject({ stored: 9, pending: 1, mode: "guest" });
    expect(qualifyingPeople(people)).toHaveLength(0);
    expect(countPeople([])).toEqual([]);
  });
});
