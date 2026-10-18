/**
 * Envelope encryption (B4): each secret gets its own random data key (DEK). The secret is sealed with
 * the DEK, and the DEK is sealed with the key-encryption key (KEK, `KEY_ENCRYPTION_KEY`). Both use
 * AES-256-GCM with the record's ID as associated data, so a sealed blob can't be swapped onto another
 * remora. Rotating the KEK only rewraps DEKs.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface Sealed {
  v: 1;
  alg: "aes-256-gcm";
  /** The DEK wrapped by the KEK: iv, ciphertext, tag (base64). */
  dek: { iv: string; ct: string; tag: string };
  /** The secret sealed by the DEK. */
  data: { iv: string; ct: string; tag: string };
}

const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");
const unb64 = (s: string) => Buffer.from(s, "base64");

function gcmSeal(key: Uint8Array, plaintext: Uint8Array, aad: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv: b64(iv), ct: b64(ct), tag: b64(cipher.getAuthTag()) };
}

function gcmOpen(key: Uint8Array, box: { iv: string; ct: string; tag: string }, aad: string) {
  const decipher = createDecipheriv("aes-256-gcm", key, unb64(box.iv));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(unb64(box.tag));
  return new Uint8Array(Buffer.concat([decipher.update(unb64(box.ct)), decipher.final()]));
}

/** Parses `KEY_ENCRYPTION_KEY` (64 hex chars). */
export function parseKek(hex: string): Uint8Array {
  if (!/^[0-9a-fA-F]{64}$/.test(hex))
    throw new Error("KEY_ENCRYPTION_KEY must be 64 hex characters");
  return new Uint8Array(Buffer.from(hex, "hex"));
}

export function seal(secret: Uint8Array, kek: Uint8Array, aad: string): Sealed {
  const dek = randomBytes(32);
  try {
    return {
      v: 1,
      alg: "aes-256-gcm",
      dek: gcmSeal(kek, dek, aad),
      data: gcmSeal(dek, secret, aad),
    };
  } finally {
    dek.fill(0);
  }
}

/** Throws if the KEK, the associated data or any byte of the blob is wrong. */
export function open(sealed: Sealed, kek: Uint8Array, aad: string): Uint8Array {
  if (sealed.v !== 1 || sealed.alg !== "aes-256-gcm") throw new Error("unknown envelope version");
  const dek = gcmOpen(kek, sealed.dek, aad);
  try {
    return gcmOpen(dek, sealed.data, aad);
  } finally {
    dek.fill(0);
  }
}

/** Rewraps the DEK under a new KEK without touching the sealed secret. */
export function rewrap(
  sealed: Sealed,
  oldKek: Uint8Array,
  newKek: Uint8Array,
  aad: string,
): Sealed {
  const dek = gcmOpen(oldKek, sealed.dek, aad);
  try {
    return { ...sealed, dek: gcmSeal(newKek, dek, aad) };
  } finally {
    dek.fill(0);
  }
}
