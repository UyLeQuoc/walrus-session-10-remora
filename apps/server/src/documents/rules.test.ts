import { describe, expect, it } from "vitest";
import {
  documentValues,
  fileOwner,
  recordBody,
  SEAL_PREFIX_HEX,
  sealIdBelongsTo,
} from "./rules.ts";

const WALLET = `0x${"ab".repeat(32)}`;
const OWNER = { walletAddress: WALLET, accountId: `0x${"cd".repeat(32)}` };
const SEAL_ID = `${SEAL_PREFIX_HEX}${"ab".repeat(32)}0000000000000000`;

const input = recordBody.parse({
  blobId: "blob-1",
  sealId: SEAL_ID,
  ciphertextSha256: "e".repeat(64),
  name: "secret plans.md",
  mediaType: "text/markdown",
  byteSize: 120,
});

describe("document rules", () => {
  it("lets only an owned person with a wallet and an account keep a file", () => {
    expect(fileOwner({ mode: "owned", ...OWNER })).toEqual(OWNER);
    expect(fileOwner({ mode: "guest", ...OWNER })).toBeNull();
    expect(
      fileOwner({ mode: "owned", walletAddress: null, accountId: OWNER.accountId }),
    ).toBeNull();
  });

  it("accepts a seal identity only for the person's own wallet", () => {
    expect(sealIdBelongsTo(SEAL_ID, WALLET)).toBe(true);
    expect(sealIdBelongsTo(SEAL_ID, `0x${"ff".repeat(32)}`)).toBe(false);
    expect(sealIdBelongsTo(`00${SEAL_ID.slice(2)}`, WALLET)).toBe(false);
  });

  it("never puts the file name in a column in the clear", () => {
    const row = documentValues("person-1", OWNER, input, (name) => `sealed(${name.length})`);
    expect(row.nameEnc).toBe("sealed(15)");
    expect(JSON.stringify(row)).not.toContain("secret plans");
  });

  it("refuses a file over the limit or of a type it cannot read", () => {
    expect(recordBody.safeParse({ ...input, byteSize: 200 * 1024 }).success).toBe(false);
    expect(recordBody.safeParse({ ...input, mediaType: "application/pdf" }).success).toBe(false);
  });
});
