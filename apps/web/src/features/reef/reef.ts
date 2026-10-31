/**
 * E7/H4: one Reef service, from `GET /api/reef/services` (a bare array).
 *
 * Mirrors what the repo already says about Reef payees: the server's `ReefEntry`/`ResolvedReef`
 * (`apps/server/src/money/reef.ts`) carries `name` and `payTo`, and the hatch consent's `payees`
 * (`packages/schema/src/hatchery.ts`) carries `priceUsdc` as a micro-USDC integer string. So
 * `priceUsdc` here is micro-USDC (6 decimals) as a non-negative integer string, like every other
 * money field the web app parses (`lib/usdc.ts`): `"10000"` is $0.01 per call. The server entry has
 * listing (`reefServices` in `apps/server/src/money/reef.ts`) adds `category` and `docsUrl`.
 *
 * The shape lives in `packages/schema` (ADR-0076).
 */
import { ReefService, ReefServices } from "@remora/schema";
import { usdc } from "@/lib/usdc";

export { ReefService, ReefServices };

/** "$0.01"; "$0.015" when the price needs more digits; "Free" for zero. */
export function formatPrice(priceUsdc: string): string {
  return BigInt(priceUsdc) === 0n ? "Free" : `$${usdc(priceUsdc)}`;
}

/** The distinct categories, sorted. */
export function categoriesOf(services: ReefService[]): string[] {
  return [...new Set(services.map((s) => s.category))].sort((a, b) => a.localeCompare(b));
}

/** Services whose name or category contains the query (case-insensitive) and, if set, match the category. */
export function filterServices(
  services: ReefService[],
  query: string,
  category: string | null,
): ReefService[] {
  const q = query.trim().toLowerCase();
  return services.filter(
    (s) =>
      (!category || s.category === category) &&
      (!q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)),
  );
}
