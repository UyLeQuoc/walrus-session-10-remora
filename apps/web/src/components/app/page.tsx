/**
 * The one place a page's width, padding, scroll area and document title are decided (ADR-0036).
 *
 * Every page is the full width of the shell: one gutter (`px-4 sm:px-6 lg:px-10`), no centred
 * `max-w-*` track, no `mx-auto`. That keeps the `h1` on the same x on every route (Phase 6 §2).
 * A form whose fields would become unreadable when stretched constrains its own fields to
 * `max-w-2xl`; the page header and section headings stay on the page's left edge.
 *
 * `PageHeader` and `Section` live beside it so every page has the same heading scale and spacing.
 */
import type { ReactNode } from "react";
import { useInRouterContext, useLocation } from "react-router";
import { useShellTitle } from "@/app/shell";
import { usePageMeta } from "@/hooks/use-page-meta";
import { cn } from "@/lib/utils";

/** The page's own full-width column; used by `Page` and the `RequireOwner` banners. */
export function PageColumn({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      data-slot="page-column"
      className={cn("flex w-full flex-col px-4 sm:px-6 lg:px-10", className)}
    >
      <div className="flex w-full flex-col gap-6">{children}</div>
    </div>
  );
}

type PageProps = {
  /** Also the document title: "Remoras" renders "Remoras · Remora". Use "Remora" for Home. */
  title: string;
  description?: string;
  index?: boolean;
  children: ReactNode;
};

function RoutedMeta({
  title,
  description,
  index,
}: Required<Pick<PageProps, "title" | "description" | "index">>) {
  const { pathname } = useLocation();
  usePageMeta({
    title: title === "Remora" ? "Remora" : `${title} · Remora`,
    description,
    path: pathname,
    index,
  });
  return null;
}

function PlainMeta({
  title,
  description,
  index,
}: Required<Pick<PageProps, "title" | "description" | "index">>) {
  usePageMeta({
    title: title === "Remora" ? "Remora" : `${title} · Remora`,
    description,
    path: "/",
    index,
  });
  return null;
}

export function Page({ title, description = "", index = false, children }: PageProps) {
  useShellTitle(title);
  const inRouter = useInRouterContext();
  const meta = { title, description, index };
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto">
      <PageColumn className="py-6 md:py-8">
        {inRouter ? <RoutedMeta {...meta} /> : <PlainMeta {...meta} />}
        {children}
      </PageColumn>
    </div>
  );
}

export { PageHeader } from "./page-header";
export { Section } from "./section";
