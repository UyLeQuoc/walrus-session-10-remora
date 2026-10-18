import { z } from "zod";

/** A Sui address or object ID: `0x` + up to 64 hex characters. */
export const SuiAddress = z.string().regex(/^0x[0-9a-fA-F]{1,64}$/, "not a Sui address");
export const ObjectId = SuiAddress;
/** A Walrus blob ID (base64url). */
export const BlobId = z.string().regex(/^[A-Za-z0-9_-]{8,}$/, "not a Walrus blob id");
/** Lower-case SHA-256 hex. */
export const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/, "not a sha256 hex digest");
/** An amount in the coin's smallest unit, as a decimal string (USDC has 6 decimals). */
export const Amount = z.string().regex(/^\d+$/, "amount must be an integer string");
/** ISO-8601 timestamp with an offset or Z. */
export const IsoDateTime = z.iso.datetime({ offset: true });
/** A Reef service reference: `reef:<slug>`. Templates and budgets never carry raw payee addresses. */
export const ReefRef = z.string().regex(/^reef:[a-z0-9-]+$/, "not a reef:<slug> reference");
