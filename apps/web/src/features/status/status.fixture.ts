/** Local fixture for `GET /api/status`. TODO: moves to `packages/schema/fixtures` with the contract PR. */
import type { PublicStatus } from "./status-contract";

export const STATUS_OK: PublicStatus = {
  status: "ok",
  items: [
    { name: "Database", status: "ok" },
    { name: "Checkpoint watcher", status: "ok" },
    { name: "Memory relayer", status: "ok" },
    { name: "Sponsor gas", status: "ok" },
  ],
};

export const STATUS_DEGRADED: PublicStatus = {
  status: "degraded",
  items: [
    { name: "Database", status: "ok" },
    { name: "Checkpoint watcher", status: "ok" },
    { name: "Memory relayer", status: "degraded" },
    { name: "Sponsor gas", status: "down" },
  ],
};
