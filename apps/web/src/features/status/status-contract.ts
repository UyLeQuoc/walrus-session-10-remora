/**
 * The public `GET /api/status` response (H2). Only a name and a status per item cross this line.
 * The shape lives in `packages/schema` (ADR-0076).
 *
 * zod strips unknown keys, so `detail`, `fix`, `value`, `threshold` and `traceId` can never reach
 * the page even if the server sends them.
 */
export { PublicStatus, PublicStatusItem } from "@remora/schema";
