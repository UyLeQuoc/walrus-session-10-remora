/**
 * M12 (ADR-0149): an embeddable badge for a template. It previews the live SVG (`/badge/:id.svg`: the
 * name and the hatch count) and offers two read-only snippets (Markdown and HTML) that show it and
 * link back to `/hatchery/:templateId` on this site, with copy buttons for each.
 */
import { GitFork } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { badgeUrl } from "./extras-api";

type Kind = "markdown" | "html";
type Status = { kind: Kind; ok: boolean } | null;

const COPIED_MS = 2000;

export function HatchBadge({ templateId, name }: { templateId: string; name: string }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const path = `/hatchery/${templateId}`;
  const img = badgeUrl(origin, templateId);
  // The name is the author's text: escaped for each snippet's syntax.
  const alt = `Use this remora: ${name}`;
  const markdown = `[![${alt.replace(/[[\]\\]/g, "\\$&")}](${img})](${origin}${path})`;
  const html = `<a href="${origin}${path}"><img src="${img}" alt="${alt.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}" /></a>`;

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
      <span className="text-md text-ob-muted" role="status">
        {status.ok ? "Copied" : "Copy failed"}
      </span>
    ) : null;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div data-testid="hatch-badge">
        <Link
          to={path}
          className="inline-flex max-w-full items-center gap-3 rounded-ob-card border border-ob-border-grouped bg-ob-grouped px-4 py-3 text-ob-text no-underline transition-colors hover:bg-ob-control-hover"
        >
          <GitFork className="size-5 shrink-0" aria-hidden />
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">Use this remora</span>
            <span className="truncate text-md text-ob-muted">{name}</span>
          </span>
        </Link>
        <img
          src={img}
          alt={`${name}: hatch count`}
          className="mt-3 block h-5 w-auto"
          data-testid="hatch-badge-svg"
        />
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
          className="overflow-x-auto rounded-ob-lg bg-ob-control-hover p-3 font-mono text-xs text-ob-secondary"
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
          className="overflow-x-auto rounded-ob-lg bg-ob-control-hover p-3 font-mono text-xs text-ob-secondary"
          data-testid="hatch-badge-html"
        >
          {html}
        </pre>
      </div>
    </div>
  );
}
