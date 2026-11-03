/**
 * A titled group inside a page (plan §2.2): an `h2` and its content, with no card border, so a form
 * group or an info group stops looking like an object. `tone="danger"` is the Danger zone.
 * `layout="split"` puts the heading in a left column on wide screens and lets the content take the
 * rest of the page's width, the usual shape of a settings page. Drawn as openbot's settings
 * section (ADR-0069): a quiet heading, then the body (often a `SettingsGroup`).
 */
import type { ReactNode } from "react";
import { Hint } from "@/components/visual";
import { SettingsSection } from "@/openbot/pages";

export function Section({
  title,
  description,
  actions,
  tone = "default",
  layout = "stack",
  hint,
  badge,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** The longer explanation, behind a `?` beside the heading (ADR-0103). */
  hint?: ReactNode;
  /** A status chip beside the heading. */
  badge?: ReactNode;
  actions?: ReactNode;
  tone?: "default" | "danger";
  layout?: "stack" | "split";
  children: ReactNode;
}) {
  return (
    <SettingsSection
      title={title}
      description={description}
      actions={actions}
      badge={
        hint || badge ? (
          <>
            {badge}
            {hint ? <Hint>{hint}</Hint> : null}
          </>
        ) : undefined
      }
      tone={tone}
      layout={layout}
    >
      {children}
    </SettingsSection>
  );
}
