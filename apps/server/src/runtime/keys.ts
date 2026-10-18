/** B4: the Postgres `KeyStore` for `@remora/signer`. Only sealed envelopes are stored here. */
import { type Db, eq, remoraKeys } from "@remora/db";
import type { KeyStore, Sealed, StoredKey } from "@remora/signer";

export class PgKeyStore implements KeyStore {
  constructor(private readonly db: Db) {}

  async get(remoraId: string): Promise<StoredKey | null> {
    const [row] = await this.db.select().from(remoraKeys).where(eq(remoraKeys.remoraId, remoraId));
    if (!row) return null;
    return {
      remoraId: row.remoraId,
      network: row.network,
      address: row.address,
      sealed: row.sealed as unknown as Sealed,
    };
  }

  async put(key: StoredKey): Promise<void> {
    await this.db
      .insert(remoraKeys)
      .values({
        remoraId: key.remoraId,
        network: key.network,
        address: key.address,
        sealed: key.sealed as unknown as Record<string, unknown>,
      })
      .onConflictDoNothing({ target: remoraKeys.remoraId });
  }
}
