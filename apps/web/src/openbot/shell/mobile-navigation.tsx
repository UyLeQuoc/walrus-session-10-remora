/*
 * Ported from nightly-labs/openbot src/renderer/src/features/web-client/WebMobileNavigation.tsx @ aa3c498.
 * PolyForm Noncommercial 1.0.0, see ../LICENSE.
 *
 * The small-screen switch between the panes. Only drawn at 720px and below (shell.css).
 */
import type { CSSProperties, ReactNode } from "react";

export type MobileNavItem<T extends string> = {
  id: T;
  label: string;
  icon: ReactNode;
  /** A count beside the label, such as approvals waiting. */
  count?: number;
};

export function MobileNavigation<T extends string>({
  label,
  items,
  active,
  onChange,
}: {
  label: string;
  items: ReadonlyArray<MobileNavItem<T>>;
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <nav className="web-mobile-navigation" aria-label={label}>
      <div
        className="web-mobile-navigation-list"
        style={{ "--web-mobile-navigation-items": items.length } as CSSProperties}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="web-mobile-navigation-button"
            data-active={item.id === active ? "true" : undefined}
            aria-pressed={item.id === active}
            onClick={() => onChange(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.count ? <span className="window-rail-count static">{item.count}</span> : null}
          </button>
        ))}
      </div>
    </nav>
  );
}
