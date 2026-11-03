/**
 * The title block for a page (plan §2.2): an `h1`, an optional badge and description, and actions
 * that wrap under the title on narrow screens. Drawn as openbot's page heading (ADR-0069).
 */
import type { ReactNode } from "react";
import { Hint } from "@/components/visual";
import { PageHeading } from "@/openbot/pages";

export function PageHeader({
  title,
  description,
  actions,
  badge,
  hint,
}: {
  title: ReactNode;
  /** One short line: what the page is for (ADR-0103). */
  description?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  /** The longer explanation, behind a `?` beside the title, with a link to the guide. */
  hint?: ReactNode;
}) {
  return (
    <PageHeading
      title={title}
      description={description}
      actions={actions}
      badge={
        hint ? (
          <>
            {badge}
            <Hint>{hint}</Hint>
          </>
        ) : (
          badge
        )
      }
    />
  );
}
