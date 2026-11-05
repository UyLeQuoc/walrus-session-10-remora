/**
 * B4: remora keys. Generated here, stored sealed, decrypted only for the moment of signing. No method
 * returns the secret, and the decrypted bytes are zeroed after use.
 */
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { open, type Sealed, seal } from "./envelope.ts";

export type KeyNetwork = "testnet" | "mainnet";

export interface StoredKey {
  remoraId: string;
  network: KeyNetwork;
  address: string;
  sealed: Sealed;
}

/** Persistence (Postgres in the server; a Map in tests). */
export interface KeyStore {
  get(remoraId: string): Promise<StoredKey | null>;
  put(key: StoredKey): Promise<void>;
}

export class RemoraSigner {
  readonly #kek: Uint8Array;

  constructor(
    private readonly store: KeyStore,
    kek: Uint8Array,
  ) {
    this.#kek = new Uint8Array(kek);
  }

  /** Creates the remora's key once; later calls return the same address. */
  async create(remoraId: string, network: KeyNetwork): Promise<string> {
    const existing = await this.store.get(remoraId);
    if (existing) return existing.address;
    const kp = new Ed25519Keypair();
    const secret = kp.getSecretKey();
    const raw = new TextEncoder().encode(secret);
    const sealed = seal(raw, this.#kek, aad(remoraId));
    raw.fill(0);
    const address = kp.toSuiAddress();
    await this.store.put({ remoraId, network, address, sealed });
    return address;
  }

  async address(remoraId: string): Promise<string> {
    const k = await this.store.get(remoraId);
    if (!k) throw new Error(`no key for remora ${remoraId}`);
    return k.address;
  }

  /** Signs built transaction bytes as the remora. */
  async signTransaction(remoraId: string, bytes: Uint8Array): Promise<string> {
    return this.#withKeypair(remoraId, async (kp) => (await kp.signTransaction(bytes)).signature);
  }

  /** ADR-0130: signs a personal message as the remora (a Seal session key for a memory capsule). */
  async signPersonalMessage(remoraId: string, bytes: Uint8Array): Promise<string> {
    return this.#withKeypair(
      remoraId,
      async (kp) => (await kp.signPersonalMessage(bytes)).signature,
    );
  }

  /**
   * ADR-0143: a secret the owner gave one of the remora's connections (an MCP server's bearer
   * token), sealed like the remora's key. The associated data names the remora and the connection,
   * and never matches a remora key's, so this can't open one.
   */
  sealSecret(remoraId: string, name: string, secret: string): Sealed {
    const raw = new TextEncoder().encode(secret);
    try {
      return seal(raw, this.#kek, secretAad(remoraId, name));
    } finally {
      raw.fill(0);
    }
  }

  /** Throws when the blob was sealed for another remora or connection, or was changed. */
  openSecret(remoraId: string, name: string, sealed: Sealed): string {
    const raw = open(sealed, this.#kek, secretAad(remoraId, name));
    try {
      return new TextDecoder().decode(raw);
    } finally {
      raw.fill(0);
    }
  }

  async #withKeypair<T>(remoraId: string, use: (kp: Ed25519Keypair) => Promise<T>): Promise<T> {
    const k = await this.store.get(remoraId);
    if (!k) throw new Error(`no key for remora ${remoraId}`);
    const raw = open(k.sealed, this.#kek, aad(remoraId));
    try {
      const kp = Ed25519Keypair.fromSecretKey(new TextDecoder().decode(raw));
      if (kp.toSuiAddress() !== k.address) throw new Error(`key mismatch for remora ${remoraId}`);
      return await use(kp);
    } finally {
      raw.fill(0);
    }
  }

  /** Keeps the KEK out of logs and JSON. */
  toJSON() {
    return { signer: "RemoraSigner" };
  }
}

const aad = (remoraId: string) => `remora-key:${remoraId}`;
const secretAad = (remoraId: string, name: string) => `remora-secret:${remoraId}:${name}`;

/** In-memory store for tests and scripts. */
export class MemoryKeyStore implements KeyStore {
  readonly keys = new Map<string, StoredKey>();
  async get(remoraId: string) {
    return this.keys.get(remoraId) ?? null;
  }
  async put(key: StoredKey) {
    this.keys.set(key.remoraId, key);
  }
}
