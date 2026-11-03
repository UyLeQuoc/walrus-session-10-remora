/**
 * `/remoras` (H4 dashboard): every remora with its status and budget, filtered by kind. Home already
 * shows what waits for you and the activity (ADR-0103), so this page is the list. The empty state is
 * one block with two templates.
 */
import { AlertTriangle, Download, Plus, Upload } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Page, PageHeader } from "@/components/app/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Empty } from "@/components/visual";
import { kindName } from "@/lib/kind";
import { useNetwork } from "@/lib/network";
import { CardGrid } from "@/openbot/pages";
import { api, exportTeam } from "./api";
import { RequireOwner, useLoad } from "./hooks";
import { RemoraCard } from "./remora-card";
import { TemplateCard } from "./template-card";

/** ADR-0042: the team as one Markdown file, without keys, memories or watched addresses. */
async function downloadTeam() {
  const out = await exportTeam();
  if (!out.ok) return void toast.error(out.error);
  const url = URL.createObjectURL(new Blob([out.data], { type: "text/markdown" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "remora-team.md";
  a.click();
  URL.revokeObjectURL(url);
}

function Dashboard() {
  const network = useNetwork();
  const remoras = useLoad(() => api.remoras(), [], 30_000);
  const templates = useLoad(() => api.templates(), []);
  const [kind, setKind] = useState("all");
  const live = (remoras.data?.remoras ?? []).filter((r) => r.status !== "retired");
  const kinds = [...new Set(live.map((r) => r.template))];
  const shown = kind === "all" ? live : live.filter((r) => r.template === kind);
  const list = Object.entries(templates.data?.templates ?? {});

  return (
    <Page title="Remoras" description="Your always-on agents and what they did lately.">
      <PageHeader
        title="Remoras"
        description={remoras.data ? `${live.length} on ${network}` : undefined}
        actions={
          <>
            {live.length ? (
              <Button type="button" variant="ghost" onClick={() => void downloadTeam()}>
                <Download /> Export team
              </Button>
            ) : null}
            <Button asChild variant="ghost">
              <Link to="/remoras/import">
                <Upload /> Import a team
              </Link>
            </Button>
            <Button asChild>
              <Link to="/remoras/new">
                <Plus /> New remora
              </Link>
            </Button>
          </>
        }
      />

      {remoras.error ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Couldn't read your remoras</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            {remoras.error}
            <Button variant="outline" size="sm" onClick={() => void remoras.refresh()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {kinds.length > 1 ? (
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={kind}
          onValueChange={(v) => v && setKind(v)}
          aria-label="Show"
          className="w-fit"
        >
          <ToggleGroupItem value="all">All {live.length}</ToggleGroupItem>
          {kinds.map((k) => (
            <ToggleGroupItem key={k} value={k}>
              {kindName(k)} {live.filter((r) => r.template === k).length}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : null}

      {remoras.loading && !remoras.data ? (
        <CardGrid>
          <Skeleton className="h-36 w-full rounded-ob-card" />
          <Skeleton className="h-36 w-full rounded-ob-card" />
        </CardGrid>
      ) : live.length ? (
        <CardGrid>
          {shown.map((r) => (
            <RemoraCard key={r.id} remora={r} />
          ))}
        </CardGrid>
      ) : (
        <Empty
          title="Your first remora: pick a kind."
          action={
            <CardGrid className="w-full max-w-2xl text-left">
              {list.map(([slug, template]) => (
                <TemplateCard key={slug} slug={slug} template={template} />
              ))}
            </CardGrid>
          }
        />
      )}
    </Page>
  );
}

export function RemorasPage() {
  return <RequireOwner what="your remoras">{() => <Dashboard />}</RequireOwner>;
}
