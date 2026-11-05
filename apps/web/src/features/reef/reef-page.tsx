/**
 * `/reef` (E7·ui, H4): the directory of paid services a remora may pay. Read only: what each does,
 * what a call costs and which address gets paid. A table on desktop, cards at the shell's phone
 * breakpoint. If the endpoint is missing or fails, the page says so quietly.
 */
import { ExternalLink, SearchX, Waves } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { EmptyState } from "@/components/app/empty-state";
import { Term } from "@/components/app/glossary";
import { Page, PageHeader } from "@/components/app/page";
import { Hash } from "@/components/hash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { NamedAddress } from "@/features/names/sui-name";
import { usePhone } from "@/hooks/use-phone";
import { DataTable, SettingsGroup } from "@/openbot/pages";
import { useReefServices } from "./hooks";
import { categoriesOf, filterServices, formatPrice, type ReefService } from "./reef";

function Docs({ service }: { service: ReefService }) {
  return (
    <a
      className="link inline-flex items-center gap-1 text-sm"
      href={service.docsUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      Docs
      <span className="sr-only"> for {service.name}</span>
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}

function ServiceTable({ rows }: { rows: ReefService[] }) {
  return (
    <DataTable>
      <thead>
        <tr>
          <th>Name</th>
          <th>Category</th>
          <th data-align="right">Price (USDC per call)</th>
          <th>Last 7 days</th>
          <th>Pays to</th>
          <th>Docs</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={`${s.name}:${s.payTo}`} data-testid="reef-row">
            <td className="font-medium">{s.name}</td>
            <td data-tone="muted">{s.category}</td>
            <td data-align="right" data-numeric>
              {formatPrice(s.priceUsdc)}
            </td>
            <td data-tone="muted">
              <Score service={s} />
            </td>
            <td className="w-64 max-w-64">
              <NamedAddress value={s.payTo} label={`${s.name} address`} />
            </td>
            <td>
              <Docs service={s} />
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

/** ADR-0127: what owners who share counts saw this week, or "new" until there's enough. */
function Score({ service: s }: { service: ReefService }) {
  if (!s.score) return <span>—</span>;
  const extra =
    s.score.status === "scored"
      ? [
          s.score.settledPct !== null ? `${s.score.settledPct}% settled` : null,
          s.score.medianMs !== null ? `${(s.score.medianMs / 1000).toFixed(1)} s median` : null,
        ].filter(Boolean)
      : [];
  return (
    <span data-testid="reef-score" title="From remoras whose owners share their counts">
      {s.score.line}
      {extra.length ? ` · ${extra.join(" · ")}` : ""}
    </span>
  );
}

function ServiceCards({ rows }: { rows: ReefService[] }) {
  return (
    <SettingsGroup as="ul" aria-label="Paid services">
      {rows.map((s) => (
        <li
          key={`${s.name}:${s.payTo}`}
          className="flex min-w-0 flex-col gap-1.5 px-4 py-3 text-md"
          data-testid="reef-card"
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className="font-medium">{s.name}</span>
            <span className="tabular-nums">{formatPrice(s.priceUsdc)} per call</span>
          </span>
          <span className="text-ob-muted">{s.category}</span>
          <span className="text-sm text-ob-secondary">
            <Score service={s} />
          </span>
          <Hash value={s.payTo} label={`${s.name} address`} />
          <Docs service={s} />
        </li>
      ))}
    </SettingsGroup>
  );
}

function Directory({ services }: { services: ReefService[] }) {
  const phone = usePhone();
  const [q, setQ] = useState("");
  const [picked, setCategory] = useState<string | null>(null);
  const categories = categoriesOf(services);
  // A chip that is gone (a network switch changed the data) means "all", not an empty table.
  const category = picked && categories.includes(picked) ? picked : null;
  const rows = filterServices(services, q, category);

  return (
    <div className="flex flex-col gap-4">
      <Input
        className="max-w-xs"
        type="search"
        aria-label="Search services"
        placeholder="Search by name or category"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <Toggle
            key={c}
            variant="outline"
            size="sm"
            className="rounded-full"
            pressed={category === c}
            aria-label={`Filter by ${c}`}
            onPressedChange={(on) => setCategory(on ? c : null)}
          >
            {c}
          </Toggle>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title="No services match"
          description="Try a different name, or clear the category filter."
        />
      ) : phone ? (
        <ServiceCards rows={rows} />
      ) : (
        <ServiceTable rows={rows} />
      )}
    </div>
  );
}

export function ReefPage() {
  const query = useReefServices();
  return (
    <Page title="Services" description="The paid services your remoras can buy from.">
      <PageHeader
        title={<Term name="services">Services</Term>}
        description={
          <>
            This directory lists the paid services a remora may pay: what each one does, what a call
            costs and which address gets paid.
          </>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/reef/new">List your API</Link>
          </Button>
        }
      />
      {query.isPending ? (
        <div data-testid="reef-loading" className="flex flex-col gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-40 w-full rounded-ob-card" />
        </div>
      ) : query.isError ? (
        <p className="flex items-center gap-2 text-md text-ob-muted" data-testid="reef-error">
          <Waves className="size-4 shrink-0" aria-hidden />
          The services directory isn't available yet
        </p>
      ) : query.data.length === 0 ? (
        <EmptyState
          icon={<Waves />}
          title="No services yet"
          description="No paid services are listed on this network yet."
        />
      ) : (
        <Directory services={query.data} />
      )}
    </Page>
  );
}
