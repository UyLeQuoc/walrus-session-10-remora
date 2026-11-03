/*
 * Ported from nightly-labs/openbot packages/ui/src/settings.tsx (SettingsSection) and
 * packages/ui/src/features/settings/SettingsDialogShell.tsx (the header) @ aa3c498.
 * PolyForm Noncommercial 1.0.0, see ../LICENSE.
 *
 * A page's heading (the h1, a badge, a line under it and the actions on the right) and a titled
 * section (an h2, an optional line, actions, and the body). Presentational only. Unlike upstream the
 * section is not labelled by its heading: Remora's lists inside often carry the same name, and two
 * elements with one label would make the label ambiguous.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeading({
  title,
  description,
  actions,
  badge,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="page-header" className={cn("ob-page-header", className)}>
      <div className="ob-page-header-copy">
        <div className="ob-page-title-row">
          <h1 className="ob-page-title">{title}</h1>
          {badge}
        </div>
        {description ? <p className="ob-page-description">{description}</p> : null}
      </div>
      {actions ? <div className="ob-page-actions">{actions}</div> : null}
    </div>
  );
}

export function SettingsSection({
  title,
  description,
  actions,
  badge,
  tone,
  layout,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Beside the heading, outside the h2 (Remora: a `?` hint, ADR-0103). */
  badge?: ReactNode;
  tone?: "default" | "danger";
  layout?: "stack" | "split";
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      data-slot="section"
      data-tone={tone === "danger" ? "danger" : undefined}
      data-layout={layout === "split" ? "split" : undefined}
      className={cn("ob-section", className)}
    >
      <div className="ob-section-header">
        <div className="ob-section-copy">
          {badge ? (
            <div className="flex items-center gap-1.5">
              <h2 className="ob-section-title">{title}</h2>
              {badge}
            </div>
          ) : (
            <h2 className="ob-section-title">{title}</h2>
          )}
          {description ? <p className="ob-section-description">{description}</p> : null}
        </div>
        {actions ? <div className="ob-section-actions">{actions}</div> : null}
      </div>
      <div className="ob-section-body">{children}</div>
    </section>
  );
}
