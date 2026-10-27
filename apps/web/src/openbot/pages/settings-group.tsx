/*
 * Ported from nightly-labs/openbot packages/ui/src/item.tsx (ItemGroup, Item and its parts),
 * packages/ui/src/surface.tsx (Card) and packages/ui/src/features/settings/settings-modal.css
 * (.settings-modal-card, .settings-modal-row, .settings-modal-readonly-value) @ aa3c498.
 * PolyForm Noncommercial 1.0.0, see ../LICENSE.
 *
 * A grouped surface and its rows: the label and its line on the left, the control on the right,
 * rows split by an inset hairline. `PropertyList` is the read-only form, a term and its value.
 */
import { Slot } from "radix-ui";
import type { ComponentProps, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The grouped surface. `as="ul"`/`"ol"` for a list of rows. */
export function SettingsGroup({
  as = "div",
  surface = "default",
  className,
  ...props
}: Omit<ComponentProps<"div">, "ref"> & {
  as?: "div" | "ul" | "ol";
  surface?: "default" | "subtle";
}) {
  const Tag = as as ElementType;
  return (
    <Tag
      data-slot="settings-group"
      data-surface={surface}
      className={cn("ob-group", className)}
      {...props}
    />
  );
}

/** A padded card on the group's surface, for content that is not rows (a form, a chart). */
export function SurfaceCard({
  tone,
  className,
  ...props
}: ComponentProps<"div"> & { tone?: "default" | "muted" }) {
  return (
    <div
      data-slot="surface-card"
      data-tone={tone === "muted" ? "muted" : undefined}
      className={cn("ob-card", className)}
      {...props}
    />
  );
}

type RowProps = {
  title?: ReactNode;
  description?: ReactNode;
  media?: ReactNode;
  actions?: ReactNode;
  size?: "compact" | "default" | "spacious";
  align?: "center" | "start";
  /** On a narrow screen, put the actions under the label. */
  stack?: boolean;
  /** Render as the single child (a link or a button), which then gets the row's hover. */
  asChild?: boolean;
  /** `li` inside a `ul`/`ol` group. */
  as?: "div" | "li";
  className?: string;
  children?: ReactNode;
} & Omit<ComponentProps<"div">, "title" | "children" | "ref">;

export function SettingsRow({
  title,
  description,
  media,
  actions,
  size = "default",
  align = "center",
  stack = false,
  asChild = false,
  as = "div",
  className,
  children,
  ...props
}: RowProps) {
  const Tag = as as ElementType;
  const attrs = {
    "data-slot": "settings-row",
    "data-size": size,
    "data-align": align === "start" ? "start" : undefined,
    "data-stack": stack ? "" : undefined,
    "data-interactive": asChild ? "" : undefined,
    className: cn("ob-row", className),
    ...props,
  };
  if (asChild) return <Slot.Root {...attrs}>{children}</Slot.Root>;
  return (
    <Tag {...attrs}>
      {media ? <div className="ob-row-media">{media}</div> : null}
      {title || description || children ? (
        <div className="ob-row-content">
          {title ? <div className="ob-row-title">{title}</div> : null}
          {description ? <div className="ob-row-description">{description}</div> : null}
          {children}
        </div>
      ) : null}
      {actions ? <div className="ob-row-actions">{actions}</div> : null}
    </Tag>
  );
}

/** The parts of a row, for a row whose whole surface is a link (`SettingsRow asChild`). */
export function RowMedia({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("ob-row-media", className)} {...props} />;
}

export function RowContent({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("ob-row-content", className)} {...props} />;
}

export function RowTitle({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("ob-row-title", className)} {...props} />;
}

export function RowDescription({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("ob-row-description", className)} {...props} />;
}

export function RowActions({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("ob-row-actions", className)} {...props} />;
}

/** Read-only facts: a term on the left, its value on the right. */
export function PropertyList({ className, ...props }: ComponentProps<"dl">) {
  return <dl data-slot="property-list" className={cn("ob-group ob-props", className)} {...props} />;
}

export function Property({
  term,
  children,
  className,
  ...props
}: { term: ReactNode; children: ReactNode } & Omit<ComponentProps<"div">, "children">) {
  return (
    <div className={cn("ob-prop", className)} {...props}>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}
