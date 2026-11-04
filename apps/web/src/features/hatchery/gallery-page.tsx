/**
 * `/hatchery` (M4, ADR-0046): every template published on this network, from the onchain events and
 * their Walrus blobs. Anyone can browse; hatching asks for a wallet on the template's page.
 */

import { Egg, GitFork, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { EmptyState } from "@/components/app/empty-state";
import { Page, PageHeader } from "@/components/app/page";
import { RemoraAvatar } from "@/components/app/remora-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/features/remoras/api";
import { useLoad } from "@/features/remoras/hooks";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { kindName } from "@/lib/kind";
import { GalleryCard } from "@/openbot/pages";
import { shortAddress } from "./parts";

const VERDICT: Record<string, { label: string; variant: "success" | "warning" | "destructive" }> = {
  pass: { label: "reviewed", variant: "success" },
  warn: { label: "check before using", variant: "warning" },
  block: { label: "blocked", variant: "destructive" },
};

export function HatcheryPage() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const query = useDebouncedValue(q, 300);
  const list = useLoad(
    () => api.hatchery({ ...(query ? { q: query } : {}), ...(kind ? { kind } : {}) }),
    [query, kind],
  );
  const [showHidden, setShowHidden] = useState(false);
  const all = list.data?.templates ?? [];
  // ADR-0103: templates the safety review blocked are hidden until asked for, so the gallery isn't
  // half red; the count stays visible. ADR-0105: so are the ones their author deprecated, which
  // nobody can use any more.
  const usable = (t: (typeof all)[number]) => t.safety !== "block" && !t.deprecated;
  const hidden = all.filter((t) => !usable(t)).length;
  const templates = showHidden ? all : all.filter(usable);
  return (
    <Page title="Templates" description="Remoras people shared, to copy into your own account.">
      <PageHeader
        title="Templates"
        description="Remoras people shared, to copy into your own."
        hint="Each one is a file on Walrus with its author onchain. Using one makes your own copy, in practice mode, with your own budget."
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-ob-muted" />
          <Input
            className="pl-8"
            aria-label="Search templates"
            placeholder="Search templates"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={kind || "all"}
          onValueChange={(v) => setKind(v === "all" || !v ? "" : v)}
          aria-label="Kind"
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="scout">Researcher</ToggleGroupItem>
          <ToggleGroupItem value="sentinel">Wallet watcher</ToggleGroupItem>
        </ToggleGroup>
        {hidden ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={showHidden}
            title="Blocked by the safety review, or deprecated by their author"
            onClick={() => setShowHidden((v) => !v)}
          >
            {showHidden ? "Hide blocked and deprecated" : `Show hidden (${hidden})`}
          </Button>
        ) : null}
      </div>
      {list.error ? <p className="text-md text-ob-danger-text">{list.error}</p> : null}
      {list.loading && !list.data ? <Skeleton className="h-40 w-full rounded-ob-card" /> : null}
      {list.data && !templates.length ? (
        <EmptyState
          icon={<Egg />}
          title={q || kind ? "No template matches" : "Nothing shared yet"}
          description="Share one of your remoras from its page (More actions → Share as a template)."
        />
      ) : null}
      <ul className="ob-card-grid" aria-label="Templates">
        {templates.map((t) => (
          <li key={t.templateId} data-testid="hatchery-card" className="min-w-0">
            <Link
              to={`/hatchery/${t.templateId}`}
              className="block h-full rounded-ob-card focus-visible:shadow-[0_0_0_1px_var(--openbot-border-focus)] focus-visible:outline-none"
            >
              <GalleryCard
                as="div"
                interactive
                className="flex flex-col"
                media={
                  <RemoraAvatar
                    id={t.templateId}
                    mood={t.safety === "block" ? "error" : "idle"}
                    size={32}
                    still
                  />
                }
                title={
                  <>
                    {t.name}
                    {t.deprecated ? <Badge variant="outline">deprecated</Badge> : null}
                  </>
                }
                byline={`by ${shortAddress(t.author)}`}
                foot={
                  <>
                    <Badge variant={VERDICT[t.safety]?.variant ?? "outline"}>
                      {VERDICT[t.safety]?.label ?? t.safety}
                    </Badge>
                    <span>{t.permissions.map((p) => kindName(p.template)).join(" + ") || "—"}</span>
                    <span
                      className="flex items-center gap-1"
                      title={`${t.forks} cop${t.forks === 1 ? "y" : "ies"} made`}
                    >
                      <GitFork className="size-3" aria-hidden />
                      <span data-testid="fork-count">{t.forks}</span>
                      <span className="sr-only">{t.forks === 1 ? "copy" : "copies"}</span>
                    </span>
                  </>
                }
              >
                {/* The author's own words: content, not interface (ADR-0103). */}
                <span data-ux-skip>{t.description}</span>
              </GalleryCard>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
