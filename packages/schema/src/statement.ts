/**
 * E6 (ADR-0122): the owner's monthly statement, `GET /api/statements?month=YYYY-MM`. Days are in the
 * owner's timezone (`timezone`, from their settings, UTC by default); amounts are smallest units.
 * The CSV (`GET /api/statements/csv`) has one row per payment of the same month.
 */
import { z } from "zod";
import { Amount, IsoDateTime } from "./common.ts";
import { Network } from "./network.ts";

export const STATEMENT_FLAGS = [
  /** A day over 3× the median of the 14 days before it (and at least 0.10 USDC). */
  "spike",
  /** The first payment ever to a payee. */
  "new_payee",
  /** A service charged ≥20% more or less than its previous payment. */
  "price_change",
  /** A `price_hike` event a remora wrote (the Subscriptions Keeper). */
  "price_hike",
  /** Three or more failed payments in a row from one remora. */
  "failed_run",
] as const;

export const StatementFlag = z.object({
  kind: z.enum(STATEMENT_FLAGS),
  day: z.iso.date(),
  at: IsoDateTime,
  remoraId: z.string().nullable(),
  remora: z.string().nullable(),
  /** The payee's label. */
  payee: z.string().nullable(),
  amount: Amount.nullable(),
  /** What `amount` is compared with: the 14-day median, or the previous price. */
  baseline: Amount.nullable(),
  /** A failed run's length. */
  count: z.number().int().nullable(),
  digest: z.string().nullable(),
  summary: z.string(),
});

const Total = z.object({ amount: Amount, payments: z.number().int().nonnegative() });

export const Statement = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  timezone: z.string().min(1),
  network: Network,
  total: Amount,
  payments: z.number().int().nonnegative(),
  /** Paid by the remoras from their spending limits. */
  byRemoras: Amount,
  /** Paid by the owner from their own wallet, approving an over-limit payment. */
  byOwner: Amount,
  /** Failed payment attempts this month. */
  failed: z.number().int().nonnegative(),
  /** Every day of the month, oldest first. */
  days: z.array(Total.extend({ day: z.iso.date() })),
  remoras: z.array(Total.extend({ id: z.string(), name: z.string() })),
  payees: z.array(Total.extend({ payee: z.string(), label: z.string(), firstPaid: IsoDateTime })),
  flags: z.array(StatementFlag),
});

export type StatementFlag = z.infer<typeof StatementFlag>;
export type Statement = z.infer<typeof Statement>;
