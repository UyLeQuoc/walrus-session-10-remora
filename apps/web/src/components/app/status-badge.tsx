/** One status → badge map for remoras, Discs, approvals and receipts (ADR-0036). */
import { Badge } from "@/components/ui/badge";

export type Status =
  | "creating"
  | "shadow"
  | "active"
  | "paused"
  | "retired"
  | "live"
  | "pending"
  | "paid"
  | "verified"
  | "failed"
  | "draft";

const VARIANT = {
  creating: "warning",
  shadow: "warning",
  active: "success",
  paused: "outline",
  retired: "outline",
  live: "success",
  pending: "warning",
  paid: "success",
  verified: "success",
  failed: "destructive",
  draft: "outline",
} as const;

export function StatusBadge({ status }: { status: Status }) {
  return <Badge variant={VARIANT[status]}>{status}</Badge>;
}
