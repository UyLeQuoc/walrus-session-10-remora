/**
 * Anything that is not a route. A stale link should tell the reader where to go rather than leave the
 * header above an empty page.
 */
import { Compass } from "lucide-react";
import { Link } from "react-router";
import { EmptyState } from "@/components/app/empty-state";
import { Page } from "@/components/app/page";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <Page title="Page not found" description="This address is not a page on Remora.">
      <EmptyState
        icon={<Compass />}
        title="Nothing here"
        description="That address is not a page. If you followed a /connect or /disconnect link, those expire after ten minutes and are single use: run the command again in the chat for a fresh one."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/">Go home</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/chat">Open chat</Link>
            </Button>
          </div>
        }
      />
    </Page>
  );
}
