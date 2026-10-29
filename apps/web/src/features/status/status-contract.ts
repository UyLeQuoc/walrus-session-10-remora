/**
 * The public `GET /api/status` response (H2). Only a name and a status per item cross this line.
 *
 * TODO: move to `packages/schema` (and the fixture to `packages/schema/fixtures`) when Uy's U9
 * contract PR for `/api/status` lands. Until then this is a local copy of the agreed shape.
 *
 * zod strips unknown keys, so `detail`, `fix`, `value`, `threshold` and `traceId` can never reach
 * the page even if the server sends them.
 */
import { HealthStatus } from "@remora/schema";
import { z } from "zod";

export const PublicStatusItem = z.object({ name: z.string(), status: HealthStatus });

export const PublicStatus = z.object({
  status: HealthStatus,
  items: z.array(PublicStatusItem),
});
export type PublicStatus = z.infer<typeof PublicStatus>;
