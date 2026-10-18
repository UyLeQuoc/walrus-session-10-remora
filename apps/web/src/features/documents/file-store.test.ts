import { describe, expect, it } from "vitest";
import { openFile, type RecordBody, sha256Hex, storeFile } from "./file-store.ts";

const SECRET = "our Postgres runs on 5433 and the root password is hunter2";

/** A stand-in for Seal: reversible, and never contains the plaintext it hides. */
const fakeSeal = {
  encrypt: async (_id: string, plain: Uint8Array) => plain.map((b) => b ^ 0x5a),
  decrypt: async (sealed: Uint8Array) => sealed.map((b) => b ^ 0x5a),
};

describe("storeFile", () => {
  it("uploads only ciphertext and tells hippo nothing but ids, a hash, a size and the name", async () => {
    const uploads: Uint8Array[] = [];
    const recorded: RecordBody[] = [];
    const stages: string[] = [];
    const result = await storeFile(
      {
        encrypt: fakeSeal.encrypt,
        writeBlob: async (ciphertext) => {
          uploads.push(ciphertext);
          return { blobId: "blob-1", blobObjectId: `0x${"1".repeat(64)}`, endEpoch: 40 };
        },
        record: async (body) => {
          recorded.push(body);
          return { id: "doc-1" };
        },
        onStage: (stage) => stages.push(stage),
      },
      {
        name: "ops.md",
        kind: "text/markdown",
        bytes: new TextEncoder().encode(SECRET),
        sealId: "seal-id",
      },
    );

    expect(result).toEqual({ id: "doc-1", blobId: "blob-1" });
    expect(stages).toEqual(["sealing", "paying", "saving"]);
    expect(uploads).toHaveLength(1);
    const uploaded = new TextDecoder().decode(uploads[0]);
    expect(uploaded).not.toContain("hunter2");
    expect(uploaded).not.toContain("5433");
    const body = JSON.stringify(recorded[0]);
    expect(body).not.toContain("hunter2");
    expect(recorded[0]?.ciphertextSha256).toBe(await sha256Hex(uploads[0] ?? new Uint8Array()));
    expect(recorded[0]?.byteSize).toBe(new TextEncoder().encode(SECRET).byteLength);
  });

  it("does not tell hippo about a file Walrus did not take", async () => {
    let recorded = false;
    await expect(
      storeFile(
        {
          encrypt: fakeSeal.encrypt,
          writeBlob: async () => {
            throw new Error("certify rejected");
          },
          record: async () => {
            recorded = true;
            return { id: "doc-1" };
          },
        },
        { name: "a.txt", kind: "text/plain", bytes: new Uint8Array([1]), sealId: "s" },
      ),
    ).rejects.toThrow(/certify rejected/);
    expect(recorded).toBe(false);
  });
});

describe("openFile", () => {
  it("reads the ciphertext back from Walrus and decrypts it in the browser", async () => {
    const sealed = await fakeSeal.encrypt("s", new TextEncoder().encode(SECRET));
    const text = await openFile(
      { fetchBlob: async () => sealed, decrypt: fakeSeal.decrypt },
      "blob-1",
    );
    expect(text).toBe(SECRET);
  });
});
