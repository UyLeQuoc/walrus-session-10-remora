/** The silent resume decision (§5): a signed-in owner with no account resumes, or asks to reconnect. */
import { describe, expect, it } from "vitest";
import { resumeDecision } from "./wallet-resume-state";

const OWNER = `0x${"a".repeat(64)}`;
const OTHER = `0x${"b".repeat(64)}`;

describe("the wallet resume decision", () => {
  it("does nothing when nobody is signed in", () => {
    expect(
      resumeDecision({ owner: null, account: null, savedAddress: OWNER, pending: false }),
    ).toBe("signed-out");
  });

  it("is done when the account is already the owner", () => {
    expect(
      resumeDecision({ owner: OWNER, account: OWNER, savedAddress: OWNER, pending: false }),
    ).toBe("connected");
    expect(
      resumeDecision({
        owner: OWNER,
        account: OWNER.toUpperCase().replace("0X", "0x"),
        savedAddress: null,
        pending: false,
      }),
    ).toBe("connected");
  });

  it("resumes when the session owner matches the saved wallet and none is connected", () => {
    expect(
      resumeDecision({ owner: OWNER, account: null, savedAddress: OWNER, pending: true }),
    ).toBe("resume");
  });

  it("asks to reconnect when the resume failed", () => {
    expect(
      resumeDecision({ owner: OWNER, account: null, savedAddress: OWNER, pending: false }),
    ).toBe("reconnect");
  });

  it("asks to reconnect when no wallet was saved, or a different one is connected", () => {
    expect(
      resumeDecision({ owner: OWNER, account: null, savedAddress: null, pending: false }),
    ).toBe("reconnect");
    expect(
      resumeDecision({ owner: OWNER, account: OTHER, savedAddress: OWNER, pending: false }),
    ).toBe("reconnect");
    expect(
      resumeDecision({ owner: OWNER, account: null, savedAddress: OTHER, pending: true }),
    ).toBe("reconnect");
  });
});
