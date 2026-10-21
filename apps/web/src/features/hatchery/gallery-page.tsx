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
import { shortAddress } from "./parts";

const VERDICT: Record<string, { label: string; variant: "secondary" | "outline" | "destructive" }> =
  {
    pass: { label: "reviewed", variant: "secondary" },
    warn: { label: "check before hatching", variant: "outline" },
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
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
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
      {list.error ? <p className="text-sm text-destructive">{list.error}</p> : null}
      {list.loading && !list.data ? <Skeleton className="h-40 w-full" /> : null}
      {list.data && !templates.length ? (
        <EmptyState
          icon={<Egg />}
          title={q || kind ? "No template matches" : "Nothing shared yet"}
          description="Share one of your remoras from its page (More actions → Share in the Hatchery)."
        />
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Templates">
        {templates.map((t) => (
          <li key={t.templateId} data-testid="hatchery-card">
            <Link
              to={`/hatchery/${t.templateId}`}
              className="flex h-full flex-col gap-2 rounded-xl border p-4 text-sm transition-colors hover:bg-muted/50"
            >
              <span className="flex flex-wrap items-center gap-2 font-medium">
                {t.name}
                {t.deprecated ? <Badge variant="outline">deprecated</Badge> : null}
                <Badge variant={VERDICT[t.safety]?.variant ?? "outline"}>
                  {VERDICT[t.safety]?.label ?? t.safety}
                </Badge>
              </span>
              <span className="line-clamp-2 text-muted-foreground">{t.description}</span>
              <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{t.permissions.map((p) => p.template).join(" + ") || "—"}</span>
                <span className="flex items-center gap-1" data-testid="fork-count">
                  <GitFork className="size-3" /> {t.forks}
                </span>
                <span>by {shortAddress(t.author)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
