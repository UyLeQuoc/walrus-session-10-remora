/** The remora's status chip, aware of its spending limit (ADR-0103; `useSpendStatus`). */
import { type Status, StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";

export function SpendBadge({
  status,
  state,
}: {
  status: Status;
  state: "checking" | "gone" | "row";
}) {
  if (state === "checking") return <Badge variant="outline">checking</Badge>;
  if (state === "gone") return <Badge variant="outline">can't spend</Badge>;
  return <StatusBadge status={status} />;
}
