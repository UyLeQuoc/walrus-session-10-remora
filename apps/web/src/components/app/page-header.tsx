/**
 * The title block for a page (plan §2.2): an `h1`, an optional badge and description, and actions
 * that wrap under the title on narrow screens. Drawn as openbot's page heading (ADR-0069).
 */
import type { ReactNode } from "react";
import { PageHeading } from "@/openbot/pages";

export function PageHeader({
  title,
  description,
  actions,
  badge,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return <PageHeading title={title} description={description} actions={actions} badge={badge} />;
}
