/**
 * The page rail (ADR-0069): Remora's pages as icons, the current one filled. Home stays lit on every
 * `/remoras*` route (`navActive`). Approvals carries the count of what waits for the owner. Each
 * button shows its page's name under the icon (ADR-0095); `short` is that name when the full one is
 * too wide.
 */
import {
  BookOpen,
  Brain,
  Cable,
  Egg,
  Fish,
  Inbox,
  MessageCircle,
  Settings,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import { navActive } from "@/app/nav-active";
import { Logo } from "@/components/logo";
import { PageRail, RailButton, RailCount } from "@/openbot";

export const RAIL_PAGES = [
  { to: "/", label: "Home", icon: Fish },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/approvals", label: "Approvals", icon: Inbox },
  { to: "/funds", label: "Funds", icon: Wallet },
  { to: "/memory", label: "Memory", icon: Brain },
  { to: "/connections", label: "Connections", icon: Cable },
  { to: "/hatchery", label: "Templates", icon: Egg },
] as const;

export const RAIL_FOOTER = [
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/verify", label: "Verify", icon: ShieldCheck },
  { to: "/guide", label: "How it works", short: "Guide", icon: BookOpen },
] as const;

export function AppRail({ pending, onNavigate }: { pending: number; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <PageRail
      label="Pages"
      labeled
      logo={
        <Link
          to="/"
          className="window-rail-logo-link"
          aria-label="Remora home"
          onClick={onNavigate}
        >
          <Logo size={22} tone="auto" />
        </Link>
      }
      top={RAIL_PAGES.map(({ to, label, icon: Icon }) => {
        const count = to === "/approvals" ? pending : 0;
        return (
          <RailButton
            key={to}
            asChild
            label={label}
            current={navActive(to, pathname)}
            count={count}
          >
            <Link to={to} onClick={onNavigate}>
              <Icon aria-hidden />
              <span className="window-rail-label" aria-hidden>
                {label}
              </span>
              <RailCount value={count} />
            </Link>
          </RailButton>
        );
      })}
      bottom={RAIL_FOOTER.map((page) => (
        <RailButton key={page.to} asChild label={page.label} current={navActive(page.to, pathname)}>
          <Link to={page.to} onClick={onNavigate}>
            <page.icon aria-hidden />
            <span className="window-rail-label" aria-hidden>
              {"short" in page ? page.short : page.label}
            </span>
          </Link>
        </RailButton>
      ))}
    />
  );
}
