/**
 * These assert promises, not wording.
 *
 * Every claim below is one a person could act on, or be harmed by not knowing.
 * The disclosure exists because somebody is about to invite friends to talk to
 * this, and none of them should learn from an article afterwards that what they
 * said is on a public network for seven months.
 */
import { describe, expect, it } from "vitest";
import { describeFailure, HELP, PRIVACY, welcome } from "./copy.ts";

describe("first contact", () => {
  it("tells a new user their words go to a public network, before they speak", () => {
    const start = welcome();
    expect(start).toMatch(/public/i);
    expect(start).toMatch(/encrypted/i);
    // The opt-out has to be in the first message, not one command deeper.
    expect(start).toMatch(/\/memory off/);
  });

  it("does not bury the disclosure under the pitch", () => {
    const start = welcome();
    const disclosure = start.search(/written to Walrus/i);
    expect(disclosure).toBeGreaterThan(-1);
    // Last line is the invitation to talk; the warning must come before it.
    expect(disclosure).toBeLessThan(start.lastIndexOf("just talk to me"));
  });

  it("keeps the survey optional and last", () => {
    expect(welcome()).not.toMatch(/helps a lot/);
    const withSurvey = welcome("https://example.com/s");
    expect(withSurvey).toMatch(/https:\/\/example\.com\/s/);
    expect(withSurvey.indexOf("https://example.com/s")).toBeGreaterThan(
      withSurvey.indexOf("just talk to me"),
    );
  });
});

describe("/privacy", () => {
  it("states the four things a person cannot find out for themselves", () => {
    // Where it goes, who can fetch it, how long it lasts, and what is public.
    expect(PRIVACY).toMatch(/Walrus/);
    expect(PRIVACY).toMatch(/anyone can download/i);
    expect(PRIVACY).toMatch(/seven months/i);
    expect(PRIVACY).toMatch(/visible on Sui/i);
  });

  it("admits the part that reflects badly on us", () => {
    // Forgetting is not deleting. Leaving this out would be the easy choice and
    // would make the ownership claim dishonest; see docs/issues/09.
    expect(PRIVACY).toMatch(/stay on Walrus until they expire/i);
    expect(PRIVACY).toMatch(/including me/i);
  });

  it("offers a way out in the same breath", () => {
    expect(PRIVACY).toMatch(/\/memory off/);
  });

  it("warns that a team sees what the team is told, and that leaving does not undo it", () => {
    // Somebody joining a shared memory has to know both halves before they
    // join, not after a colleague reads something back to them.
    expect(PRIVACY).toMatch(/everyone in it can recall/i);
    expect(PRIVACY).toMatch(/Your own memory is not shared/i);
    expect(PRIVACY).toMatch(/leaving does not take it back out/i);
  });

  it("says chat transcripts stay on the server, encrypted, and can be deleted", () => {
    expect(PRIVACY).toMatch(/not written to Walrus/i);
    expect(PRIVACY).toMatch(/other agents cannot recall it/i);
    expect(PRIVACY).toMatch(/delete a chat from the sidebar/i);
    expect(PRIVACY).toMatch(/\/memory off does not delete those chats/);
  });

  it("says that memories from before connecting stay in hippo's account", () => {
    // They cannot be moved and cannot be deleted, so hippo can still read them
    // after a revoke. Discovering that afterwards would feel like a betrayal of
    // the whole pitch; saying it up front costs nothing.
    expect(PRIVACY).toMatch(/before connecting stays in my account/i);
    expect(PRIVACY).toMatch(/after you revoke me/i);
  });
});

describe("/help", () => {
  it("lists /privacy, so the disclosure is reachable later", () => {
    expect(HELP).toMatch(/\/privacy/);
  });

  it("lists every command a user can act on", () => {
    for (const cmd of [
      "/memory",
      "/privacy",
      "/link",
      "/whoami",
      "/proof",
      "/connect",
      "/disconnect",
    ]) {
      expect(HELP).toContain(cmd);
    }
  });
});

describe("what a person is told when a turn fails", () => {
  it("does not tell someone to wait when waiting cannot help", () => {
    const outOfCredit = describeFailure(
      Object.assign(new Error("Insufficient credits"), { status: 402 }),
    );
    expect(outOfCredit).toMatch(/run out of model credit/i);
    expect(outOfCredit).not.toMatch(/try again in a moment|give me a minute/i);
    // And it should say the thing the person actually cares about.
    expect(outOfCredit).toMatch(/memory is untouched/i);
  });

  it("does tell someone to wait when waiting is exactly right", () => {
    for (const err of [
      Object.assign(new Error("boom"), { status: 429 }),
      new Error("429 Too Many Requests"),
    ]) {
      expect(describeFailure(err)).toMatch(/minute/i);
    }
  });

  it("falls back rather than guessing, and is honest about what may be lost", () => {
    const generic = describeFailure(new Error("socket hang up"));
    expect(generic).toMatch(/could not get an answer out/i);
    // Earlier memories are safe; this one may not have been written. Claiming
    // either more or less than that would be wrong.
    expect(generic).toMatch(/nothing you have told me before is lost/i);
    expect(generic).toMatch(/may not have been remembered/i);
  });

  it("survives being handed something that is not an Error", () => {
    for (const junk of [null, undefined, "boom", 42, {}]) {
      expect(typeof describeFailure(junk)).toBe("string");
    }
  });
});
