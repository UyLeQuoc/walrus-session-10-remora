/**
 * M12: an embeddable "Hatch this remora" badge for a template's author. It previews the badge and
 * offers two read-only snippets (Markdown and HTML) that link back to `/hatchery/:templateId` on
 * this site, with copy buttons for each.
 */
import { GitFork } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

type Kind = "markdown" | "html";
type Status = { kind: Kind; ok: boolean } | null;

const COPIED_MS = 2000;

export function HatchBadge({ templateId, name }: { templateId: string; name: string }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const path = `/hatchery/${templateId}`;
  const markdown = `[Hatch this remora](${origin}${path})`;
  const html = `<a href="${origin}${path}">Hatch this remora</a>`;

  const [status, setStatus] = useState<Status>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = async (kind: Kind, text: string) => {
    let ok = true;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      ok = false;
    }
    if (!alive.current) return;
    setStatus({ kind, ok });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(null), COPIED_MS);
  };

  const note = (kind: Kind) =>
    status?.kind === kind ? (
      <span className="text-sm text-muted-foreground" role="status">
        {status.ok ? "Copied" : "Copy failed"}
      </span>
    ) : null;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div data-testid="hatch-badge">
        <Link
          to={path}
          className="inline-flex max-w-full items-center gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground no-underline transition-colors hover:bg-muted"
        >
          <GitFork className="size-5 shrink-0" aria-hidden />
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">Hatch this remora</span>
            <span className="truncate text-sm text-muted-foreground">{name}</span>
          </span>
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="hatch-badge-copy-markdown"
            onClick={() => void copy("markdown", markdown)}
          >
            Copy Markdown
          </Button>
          {note("markdown")}
        </div>
        <pre
          className="overflow-x-auto rounded-md bg-muted p-3 text-xs"
          data-testid="hatch-badge-markdown"
        >
          {markdown}
        </pre>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="hatch-badge-copy-html"
            onClick={() => void copy("html", html)}
          >
            Copy HTML
          </Button>
          {note("html")}
        </div>
        <pre
          className="overflow-x-auto rounded-md bg-muted p-3 text-xs"
          data-testid="hatch-badge-html"
        >
          {html}
        </pre>
      </div>
    </div>
  );
}
