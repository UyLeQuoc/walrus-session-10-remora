/** D8: the sponsor's gas ledger, per network, sender (remora key) and UTC day. */
import { and, type Db, eq, sponsorLedger, sql } from "@remora/db";

export interface LedgerEntry {
  network: "testnet" | "mainnet";
  sender: string;
  day: string;
  digest: string;
  gasBudget: bigint;
}

export interface SponsorLedger {
  /** Reserved + settled gas for the sender today (released rows don't count). */
  spentToday(network: string, sender: string, day: string): Promise<bigint>;
  /** The gas already reserved for this digest, if any (so a re-check doesn't count it twice). */
  reservedFor(network: string, digest: string): Promise<bigint | null>;
  /** Idempotent per (network, digest). Returns false if the digest was already recorded. */
  reserve(e: LedgerEntry): Promise<boolean>;
  settle(network: string, digest: string, gasUsed: bigint): Promise<void>;
  release(network: string, digest: string): Promise<void>;
}

export const utcDay = (d: Date) => d.toISOString().slice(0, 10);

export class PgSponsorLedger implements SponsorLedger {
  constructor(private readonly db: Db) {}

  async spentToday(network: string, sender: string, day: string): Promise<bigint> {
    const [row] = await this.db
      .select({
        total: sql<string>`coalesce(sum(coalesce(${sponsorLedger.gasUsed}, ${sponsorLedger.gasBudget})), 0)`,
      })
      .from(sponsorLedger)
      .where(
        and(
          eq(sponsorLedger.network, network as "testnet"),
          eq(sponsorLedger.sender, sender),
          eq(sponsorLedger.day, day),
          sql`${sponsorLedger.status} <> 'released'`,
        ),
      );
    return BigInt(row?.total ?? 0);
  }

  async reservedFor(network: string, digest: string): Promise<bigint | null> {
    const [row] = await this.db
      .select({ gasBudget: sponsorLedger.gasBudget, status: sponsorLedger.status })
      .from(sponsorLedger)
      .where(
        and(eq(sponsorLedger.network, network as "testnet"), eq(sponsorLedger.digest, digest)),
      );
    return row && row.status !== "released" ? row.gasBudget : null;
  }

  async reserve(e: LedgerEntry): Promise<boolean> {
    const rows = await this.db
      .insert(sponsorLedger)
      .values({ ...e })
      .onConflictDoNothing({ target: [sponsorLedger.network, sponsorLedger.digest] })
      .returning({ id: sponsorLedger.id });
    return rows.length > 0;
  }

  async settle(network: string, digest: string, gasUsed: bigint): Promise<void> {
    await this.db
      .update(sponsorLedger)
      .set({ gasUsed, status: "settled" })
      .where(
        and(eq(sponsorLedger.network, network as "testnet"), eq(sponsorLedger.digest, digest)),
      );
  }

  async release(network: string, digest: string): Promise<void> {
    await this.db
      .update(sponsorLedger)
      .set({ status: "released" })
      .where(
        and(
          eq(sponsorLedger.network, network as "testnet"),
          eq(sponsorLedger.digest, digest),
          eq(sponsorLedger.status, "reserved"),
        ),
      );
  }
}

/** For tests and local scripts without Postgres. */
export class MemorySponsorLedger implements SponsorLedger {
  readonly rows = new Map<string, LedgerEntry & { gasUsed?: bigint; status: string }>();
  async spentToday(network: string, sender: string, day: string) {
    let total = 0n;
    for (const r of this.rows.values()) {
      if (
        r.network === network &&
        r.sender === sender &&
        r.day === day &&
        r.status !== "released"
      ) {
        total += r.gasUsed ?? r.gasBudget;
      }
    }
    return total;
  }
  async reservedFor(network: string, digest: string) {
    const r = this.rows.get(`${network}:${digest}`);
    return r && r.status !== "released" ? r.gasBudget : null;
  }
  async reserve(e: LedgerEntry) {
    const key = `${e.network}:${e.digest}`;
    if (this.rows.has(key)) return false;
    this.rows.set(key, { ...e, status: "reserved" });
    return true;
  }
  async settle(network: string, digest: string, gasUsed: bigint) {
    const r = this.rows.get(`${network}:${digest}`);
    if (r) Object.assign(r, { gasUsed, status: "settled" });
  }
  async release(network: string, digest: string) {
    const r = this.rows.get(`${network}:${digest}`);
    if (r?.status === "reserved") r.status = "released";
  }
}
