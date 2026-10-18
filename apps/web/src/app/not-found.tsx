/**
 * Anything that is not a route.
 *
 * Without this, react-router matched nothing and rendered nothing, so a typo or
 * an expired link left the header sitting above an empty page. A judge following
 * a stale URL would have seen a site that looks broken rather than one telling
 * them where to go.
 */
import { Link } from "react-router";
import { useShellTitle } from "@/app/shell";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/use-page-meta";

const PAGE_META = {
  title: "Page not found · hippo",
  description: "This address is not a page on hippo.",
  path: "/404",
  index: false,
};

export function NotFoundPage() {
  useShellTitle("Not found");
  usePageMeta(PAGE_META);
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-6">
      <h1 className="text-xl font-semibold tracking-tight">Nothing here</h1>
      <p className="text-sm text-muted-foreground">
        That address is not a page. If you followed a <code>/connect</code> or{" "}
        <code>/disconnect</code> link, those expire after ten minutes and are single use: run the
        command again in the chat for a fresh one.
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <Link to="/">Go to the chat</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/me">My memory</Link>
        </Button>
      </div>
    </div>
  );
}
