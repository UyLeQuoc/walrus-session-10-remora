/**
 * E11 (ADR-0111): a remora sells its answers. Its owner puts it on sale with a price, a slug and a
 * line. Another owner's remora pays `/api/x402/r/<slug>` at this owner's address, and this remora
 * answers with its own turn, paying its own sources from its own Disc. The answer settles only after
 * it's written (`settle: "after"`), so a failed answer costs the buyer nothing.
 */
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { and, desc, eq, remoraEvents, remoras, sql } from "@remora/db";
import {
  type Listings,
  SALE_PRICE,
  SALE_SLUG,
  type Sale,
  saleOf,
  salePath,
  saleRef,
} from "../money/listings.ts";
import { answersQuestions } from "../templates/index.ts";
import { saveConfig } from "./config-versions.ts";
import type { RuntimeDeps } from "./deps.ts";
import { type Remora, RemoraError } from "./remoras.ts";
import { scoutAsk } from "./scout.ts";

/** How long a sold answer may take before it's given up (and not settled). */
export const SALE_TIMEOUT_MS = 45_000;

export interface SaleInput {
  on?: unknown;
  slug?: unknown;
  price?: unknown;
  blurb?: unknown;
}

/** A sale as the owner set it, checked: a free name, a price in range (also used by restore, N11). */
export async function checkSale(deps: RuntimeDeps, r: Remora, input: SaleInput): Promise<Sale> {
  if (!answersQuestions(r.template))
    throw new RemoraError(
      "sale.unsupported",
      `${r.name} doesn't answer questions, so it can't sell answers.`,
      409,
    );
  const current = saleOf(r.config);
  const slug = String(input.slug ?? current?.slug ?? "")
    .trim()
    .toLowerCase();
  if (!SALE_SLUG.test(slug))
    throw new RemoraError(
      "sale.bad_slug",
      "Pick a name of 3–32 lowercase letters, digits or dashes, like uy-researcher.",
    );
  const price = String(input.price ?? current?.price ?? "20000");
  if (!/^\d+$/.test(price) || BigInt(price) < SALE_PRICE.min || BigInt(price) > SALE_PRICE.max)
    throw new RemoraError("sale.bad_price", "Set a price from 0.005 to 0.05 USDC an answer.");
  const blurb = String(input.blurb ?? current?.blurb ?? "")
    .trim()
    .slice(0, 140);
  const on = input.on === undefined ? (current?.on ?? false) : input.on === true;
  // One slug, one remora (retired ones free theirs).
  const taken = await deps.db
    .select({ id: remoras.id })
    .from(remoras)
    .where(
      and(
        sql`${remoras.config}->'sell'->>'slug' = ${slug}`,
        sql`${remoras.status} <> 'retired'`,
        sql`${remoras.id} <> ${r.id}`,
      ),
    )
    .limit(1);
  if (taken.length)
    throw new RemoraError("sale.slug_taken", `@${slug} is taken. Pick another name.`, 409);
  return { on, slug, price, blurb };
}

export async function setSale(
  deps: RuntimeDeps,
  listings: Listings,
  r: Remora,
  input: SaleInput,
): Promise<Sale> {
  const sale = await checkSale(deps, r, input);
  const { on, slug, price } = sale;
  await saveConfig(deps.db, r.id, (c) => ({ ...c, sell: sale }), {
    summary: () =>
      on
        ? `${r.name} is on sale as @${slug}, ${price} an answer.`
        : `${r.name} isn't on sale anymore.`,
    payload: { sale },
  });
  await listings.refresh();
  return sale;
}

/** What the remora's page shows: the sale, its address, and what it has sold. */
export async function saleView(deps: RuntimeDeps, listings: Listings, r: Remora) {
  const sale = saleOf(r.config);
  const sold = await deps.db
    .select()
    .from(remoraEvents)
    .where(
      and(
        eq(remoraEvents.remoraId, r.id),
        eq(remoraEvents.type, "action"),
        sql`${remoraEvents.payload}->>'kind' = 'sale'`,
      ),
    )
    .orderBy(desc(remoraEvents.createdAt))
    .limit(20);
  const listed = sale ? listings.bySlug(r.network, sale.slug) : undefined;
  const amounts = sold.map((e) => BigInt(String((e.payload as { amount?: string }).amount ?? 0)));
  return {
    sale,
    listed: !!listed,
    ref: sale ? saleRef(sale.slug) : null,
    url: listed?.url ?? null,
    path: sale ? salePath(sale.slug) : null,
    sold: sold.map((e) => {
      const p = e.payload as { buyer?: string; amount?: string; digest?: string };
      return {
        at: e.createdAt.toISOString(),
        buyer: p.buyer ?? "",
        amount: p.amount ?? "0",
        digest: p.digest ?? null,
      };
    }),
    earned: amounts.reduce((a, b) => a + b, 0n).toString(),
  };
}

export interface SoldAnswer {
  answer: string;
  remora: string;
  eventId: string;
  /** What this remora paid for the answer: its own receipts. */
  paid: { payee: string; amount: string; digest: string | null }[];
  at: string;
}

/** Answers a paid question. Throws a RemoraError (so nothing settles) when it can't. */
export async function sellAnswer(
  deps: RuntimeDeps,
  seller: Remora,
  slug: string,
  question: string,
  payer: string,
): Promise<SoldAnswer> {
  if (seller.status !== "active")
    throw new RemoraError("sale.closed", `@${slug} isn't answering right now.`, 409);
  if (payer && normalizeSuiAddress(payer) === normalizeSuiAddress(seller.ownerAddress))
    throw new RemoraError("sale.self", "An owner's remoras hand questions over for free.", 409);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new RemoraError("sale.timeout", `@${slug} took too long to answer.`, 409)),
      SALE_TIMEOUT_MS,
    );
  });
  try {
    const res = await Promise.race([
      scoutAsk(
        deps,
        seller,
        question,
        { kind: "webhook", ref: `sale:${payer || "unknown"}` },
        { sold: { buyer: payer } },
      ),
      timeout,
    ]);
    return {
      answer: res.answer,
      remora: `@${slug}`,
      eventId: res.eventId,
      paid: res.paid,
      at: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * After settlement: the sale in the seller's feed, with the buyer's digest. It's an `action` with
 * `kind: "sale"`, so the feed's types (a shared contract) stay as they are.
 */
export async function recordSale(
  deps: RuntimeDeps,
  seller: Remora,
  s: { slug: string; buyer: string; amount: string; digest: string; eventId: string },
) {
  await deps.db.insert(remoraEvents).values({
    remoraId: seller.id,
    network: seller.network,
    type: "action",
    summary: `Sold an answer as @${s.slug} for ${s.amount}`,
    payload: { kind: "sale", ...s },
  });
}
