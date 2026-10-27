/**
 * `/hatchery` (M4, ADR-0046): every template published on this network, from the onchain events and
 * their Walrus blobs. Anyone can browse; hatching asks for a wallet on the template's page.
 */
import { Egg, GitFork, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { EmptyState } from "@/components/app/empty-state";
import { Page, PageHeader } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/features/remoras/api";
import { useLoad } from "@/features/remoras/hooks";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { GalleryCard } from "@/openbot/pages";
import { shortAddress } from "./parts";

const VERDICT: Record<string, { label: string; variant: "success" | "warning" | "destructive" }> = {
  pass: { label: "reviewed", variant: "success" },
  warn: { label: "check before hatching", variant: "warning" },
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
  const templates = list.data?.templates ?? [];
  return (
    <Page title="Hatchery" description="Remoras people shared, to hatch into your own account.">
      <PageHeader
        title="Hatchery"
        description="Remoras people shared. Each one is a file on Walrus with its author onchain; hatching makes your own copy, in shadow mode, with your own budget."
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-ob-muted" />
          <Input
            className="pl-8"
            aria-label="Search the Hatchery"
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
          <ToggleGroupItem value="scout">Scout</ToggleGroupItem>
          <ToggleGroupItem value="sentinel">Sentinel</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {list.error ? <p className="text-md text-ob-danger-text">{list.error}</p> : null}
      {list.loading && !list.data ? <Skeleton className="h-40 w-full rounded-ob-card" /> : null}
      {list.data && !templates.length ? (
        <EmptyState
          icon={<Egg />}
          title={q || kind ? "No template matches" : "Nothing shared yet"}
          description="Share one of your remoras from its page (More actions → Share in the Hatchery)."
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
                media={<Egg />}
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
                    <span>{t.permissions.map((p) => p.template).join(" + ") || "—"}</span>
                    <span className="flex items-center gap-1" data-testid="fork-count">
                      <GitFork className="size-3" /> {t.forks}
                    </span>
                  </>
                }
              >
                {t.description}
              </GalleryCard>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
