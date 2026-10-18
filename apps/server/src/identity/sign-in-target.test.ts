import { describe, expect, it } from "vitest";
import { chooseSignInTarget } from "./sign-in-target.ts";

describe("chooseSignInTarget", () => {
  it("keeps the current person when the wallet is new", () => {
    expect(
      chooseSignInTarget({
        walletPersonId: null,
        currentPersonId: "guest",
        walletHasMemories: false,
        currentHasMemories: true,
      }),
    ).toEqual({ action: "attach", personId: "guest" });
  });

  it("folds an empty wallet person into the guest who has the memories", () => {
    expect(
      chooseSignInTarget({
        walletPersonId: "wallet",
        currentPersonId: "guest",
        walletHasMemories: false,
        currentHasMemories: true,
      }),
    ).toEqual({ action: "merge", winnerId: "guest", loserId: "wallet" });
  });

  it("folds an empty guest into the wallet that already has memories", () => {
    expect(
      chooseSignInTarget({
        walletPersonId: "wallet",
        currentPersonId: "guest",
        walletHasMemories: true,
        currentHasMemories: false,
      }),
    ).toEqual({ action: "merge", winnerId: "wallet", loserId: "guest" });
  });

  it("signs into the wallet when both sides already have memories", () => {
    expect(
      chooseSignInTarget({
        walletPersonId: "wallet",
        currentPersonId: "guest",
        walletHasMemories: true,
        currentHasMemories: true,
      }),
    ).toEqual({ action: "use", personId: "wallet" });
  });

  it("creates a person only when the browser is nobody yet", () => {
    expect(
      chooseSignInTarget({
        walletPersonId: null,
        currentPersonId: null,
        walletHasMemories: false,
        currentHasMemories: false,
      }),
    ).toEqual({ action: "create" });
  });
});
