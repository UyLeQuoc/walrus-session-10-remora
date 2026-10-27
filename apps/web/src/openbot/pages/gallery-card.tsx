/*
 * Ported from nightly-labs/openbot packages/ui/src/features/marketplace/MarketplaceCards.tsx and
 * marketplace.css (.marketplace-grid, .marketplace-card and its head, body, foot and hit area)
 * @ aa3c498. PolyForm Noncommercial 1.0.0, see ../LICENSE.
 *
 * A card in a gallery: a mark, the name (with a badge), a line under it, two lines of body and a
 * muted foot. `href`/`linkAs` make the whole card open the item through a covering hit area, so an
 * `action` inside the card still takes its own clicks.
 */
import type { ComponentProps, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function CardGrid({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-grid" className={cn("ob-card-grid", className)} {...props} />;
}

export function GalleryCard({
  media,
  bareMedia = false,
  title,
  byline,
  action,
  children,
  clamp = true,
  foot,
  hit,
  interactive = false,
  selected = false,
  as: Tag = "article",
  className,
  ...props
}: {
  media?: ReactNode;
  /** The mark draws its own background (an avatar), so the tile is left out. */
  bareMedia?: boolean;
  title: ReactNode;
  byline?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  /** Clamp the body to two lines (the marketplace's default). */
  clamp?: boolean;
  foot?: ReactNode;
  /** A link (or button) that covers the card; give it an accessible name. */
  hit?: ReactNode;
  /** The card sits inside a link: it takes the hover. */
  interactive?: boolean;
  selected?: boolean;
  as?: ElementType;
  className?: string;
} & Omit<ComponentProps<"article">, "title" | "children">) {
  return (
    <Tag
      data-slot="gallery-card"
      data-selected={selected ? "" : undefined}
      data-interactive={interactive ? "" : undefined}
      className={cn("ob-gallery-card", className)}
      {...props}
    >
      {hit}
      <div className="ob-gallery-card-head">
        {media ? (
          <span className="ob-gallery-card-media" data-bare={bareMedia ? "" : undefined}>
            {media}
          </span>
        ) : null}
        <div className="ob-gallery-card-heading">
          <h3 className="ob-gallery-card-name">{title}</h3>
          {byline ? <p className="ob-gallery-card-byline">{byline}</p> : null}
        </div>
        {action ? <div className="ob-gallery-card-action">{action}</div> : null}
      </div>
      {children ? (
        <div className="ob-gallery-card-body" data-clamp={clamp ? undefined : "none"}>
          {children}
        </div>
      ) : null}
      {foot ? <div className="ob-gallery-card-foot">{foot}</div> : null}
    </Tag>
  );
}

/** The covering hit area's class, for a router `Link` or a button the caller renders. */
export const galleryCardHit = "ob-gallery-card-hit";
