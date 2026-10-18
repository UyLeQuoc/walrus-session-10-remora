import { DOCUMENT_TEXT_LIMIT } from "@remora/core/document";
import { z } from "zod";

/** hex("hippo-doc"), the prefix every document's Seal identity starts with. */
export const SEAL_PREFIX_HEX = "686970706f2d646f63";

export const recordBody = z.object({
  blobId: z.string().min(1).max(200),
  blobObjectId: z
    .string()
    .regex(/^0x[0-9a-f]{64}$/i)
    .optional(),
  sealId: z
    .string()
    .regex(/^[0-9a-f]+$/)
    .max(200),
  ciphertextSha256: z.string().regex(/^[0-9a-f]{64}$/),
  name: z.string().trim().min(1).max(200),
  mediaType: z.enum(["text/plain", "text/markdown"]),
  byteSize: z.number().int().positive().max(DOCUMENT_TEXT_LIMIT),
  endEpoch: z.number().int().positive().optional(),
});

export type RecordInput = z.infer<typeof recordBody>;

export const turnDocument = z.object({
  id: z.uuid(),
  text: z.string().min(1).max(DOCUMENT_TEXT_LIMIT),
});

export type FileOwner = { walletAddress: string; accountId: string };

/**
 * Only an owned person has a wallet that can unseal what they store: the
 * Seal policy is their own account's, and it admits the owner and current
 * delegates, nobody else.
 */
export function fileOwner(person: {
  mode: string;
  walletAddress: string | null;
  accountId: string | null;
}): FileOwner | null {
  if (person.mode !== "owned" || !person.walletAddress || !person.accountId) return null;
  return { walletAddress: person.walletAddress, accountId: person.accountId };
}

/**
 * The identity must be sealed to this person's own account: the prefix, their
 * wallet's 32 bytes, then an 8-byte counter. Anything else would be a file this
 * person's wallet cannot open, or one sealed to someone else.
 */
export function sealIdBelongsTo(sealId: string, walletAddress: string): boolean {
  const owner = walletAddress.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  return new RegExp(`^${SEAL_PREFIX_HEX}${owner}[0-9a-f]{16}$`).test(sealId);
}

export function documentValues(
  personId: string,
  owner: FileOwner,
  input: RecordInput,
  sealName: (name: string) => string,
) {
  return {
    personId,
    walletAddress: owner.walletAddress,
    accountId: owner.accountId,
    blobId: input.blobId,
    blobObjectId: input.blobObjectId ?? null,
    sealId: input.sealId,
    ciphertextSha256: input.ciphertextSha256,
    nameEnc: sealName(input.name),
    mediaType: input.mediaType,
    byteSize: input.byteSize,
    endEpoch: input.endEpoch ?? null,
  };
}
