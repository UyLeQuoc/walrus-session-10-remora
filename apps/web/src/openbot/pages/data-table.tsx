/*
 * Ported from nightly-labs/openbot packages/ui/src/features/conversation/DataTable.tsx and
 * styles/message-content.css (.message-data-table), and packages/ui/src/features/usage/
 * agent-usage-report.css (.agent-usage-table) @ aa3c498. PolyForm Noncommercial 1.0.0, see ../LICENSE.
 *
 * A data table in a rounded frame that scrolls sideways on its own: muted 12px headers on a raised
 * band, hairline rows, tabular numbers. The cells are plain `th`/`td`; `data-align="right"`,
 * `data-tone="muted"` and `data-numeric` set their alignment, colour and figures.
 */
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function DataTable({
  className,
  frameClassName,
  ...props
}: ComponentProps<"table"> & { frameClassName?: string }) {
  return (
    <div data-slot="data-table" className={cn("ob-data-table-frame", frameClassName)}>
      <table className={cn("ob-data-table", className)} {...props} />
    </div>
  );
}
