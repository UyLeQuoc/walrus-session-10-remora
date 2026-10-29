import { apiFetch } from "@/lib/api";
import { ReefService } from "./reef";

/** Thrown for a missing endpoint, so the page can say "not available yet" instead of a raw error. */
export class ReefUnavailable extends Error {}

/** `GET /api/reef/services`. Rows that fail the schema are dropped. Rejects with `ReefUnavailable` on any failure, 404 included. */
export async function fetchReefServices(): Promise<ReefService[]> {
  let res: Response;
  try {
    res = await apiFetch("/api/reef/services");
  } catch {
    throw new ReefUnavailable("Can't reach the server.");
  }
  if (!res.ok) throw new ReefUnavailable(`Reef directory answered ${res.status}.`);
  const body: unknown = await res.json().catch(() => null);
  if (!Array.isArray(body))
    throw new ReefUnavailable("The Reef directory answered in an unknown shape.");
  // One bad row must not blank the directory: keep the rows that parse, drop the rest.
  return body.flatMap((row) => {
    const parsed = ReefService.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}
