/**
 * A3 (ADR-0147): the Memory Inspector's "Tidied" tab. What a tidy merged, from which blobs, and
 * what it hid (still on Walrus); the conflicts it found, each asking "Which one holds?".
 */
import { Sparkles } from "lucide-react";
import { useSearchParams } from "react-router";
import { EmptyState } from "@/components/app/empty-state";
import { Time } from "@/components/app/time";
import { Hash } from "@/components/hash";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Hint, Problem } from "@/components/visual";
import { api } from "@/features/remoras/api";
import { useLoad } from "@/features/remoras/hooks";
import { payeeName } from "@/lib/payee";
import { SettingsGroup, SettingsSection } from "@/openbot/pages";
import { RemoraSelect } from "./remora-select";
import { useTidy } from "./use-tidy";

export function TidiedTab() {
  const [params] = useSearchParams();
  const remoras = useLoad(() => api.remoras(), []);
  const list = (remoras.data?.remoras ?? []).filter((r) => r.status !== "creating");
  const id = params.get("remora") ?? list[0]?.id ?? "";
  const t = useTidy(id);

  if (remoras.error && !remoras.data)
    return (
      <Problem
        title="Can't reach Remora right now."
        detail={remoras.error}
        onRetry={() => void remoras.refresh()}
      />
    );
  if (remoras.loading && !remoras.data) return <Skeleton className="h-40 w-full rounded-ob-card" />;
  if (!list.length)
    return (
      <EmptyState
        icon={<Sparkles />}
        title="No remoras yet"
        description="A remora tidies its memory every week, after its review."
      />
    );

  const runs = t.data?.runs ?? [];
  const conflicts = t.data?.conflicts ?? [];
  return (
    <div className="flex flex-col gap-4" data-testid="tidied-tab">
      <div className="flex flex-wrap items-center gap-2">
        <RemoraSelect list={list} id={id} />
        <Button
          type="button"
          variant="outline"
          disabled={!!t.busy || !id}
          onClick={() => void t.tidyNow()}
          data-testid="tidy-now"
        >
          {t.busy === "tidy" ? <Spinner /> : <Sparkles aria-hidden />} Tidy now
        </Button>
        <Hint label="About tidying">
          Every week, after its review, a remora merges 3 or more notes that say the same thing
          about one service into one note, and asks you when two notes or rules disagree. Merged
          notes are hidden here; Walrus Memory can't delete a blob, so they stay on Walrus until
          they expire.
        </Hint>
      </div>
      {t.note ? <p className="text-md text-ob-secondary">{t.note}</p> : null}
      {t.error ? (
        <Alert variant="destructive">
          <AlertDescription>{t.error}</AlertDescription>
        </Alert>
      ) : null}
      {t.loadError ? (
        <Problem
          title="Couldn't read its tidies."
          detail={t.loadError}
          onRetry={() => void t.refresh()}
        />
      ) : null}

      {conflicts.length ? (
        <SettingsSection
          title="Which one holds?"
          description="Two of its notes or rules disagree. The one you pick holds; the other is corrected (its blob stays on Walrus) or, for a rule, removed."
        >
          <SettingsGroup as="ul" className="text-md" aria-label="Conflicts">
            {conflicts.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 px-4 py-3" data-testid="tidy-conflict">
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline">{payeeName(c.service)}</Badge>
                  <Badge variant="outline">{c.what}</Badge>
                  <Time value={c.createdAt} className="text-xs text-ob-muted" />
                </span>
                {(["a", "b"] as const).map((k) => (
                  <span
                    key={k}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-ob-md bg-ob-control-hover px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 break-words" data-ux-skip>
                      {c[k].label}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!!t.busy}
                      onClick={() => void t.resolve(c.id, k)}
                    >
                      {t.busy === `${c.id}:${k}` ? <Spinner /> : null} This one holds
                    </Button>
                  </span>
                ))}
                <span>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!!t.busy}
                    onClick={() => void t.dismiss(c.id)}
                  >
                    Leave both
                  </Button>
                </span>
              </li>
            ))}
          </SettingsGroup>
        </SettingsSection>
      ) : null}

      {runs.length ? (
        <SettingsGroup as="ul" className="text-md" aria-label="Tidies">
          {runs.map((run) => (
            <li key={run.id} className="flex flex-col gap-2 px-4 py-3" data-testid="tidy-run">
              <span className="flex flex-wrap items-center gap-1.5">
                <Time value={run.at} className="text-ob-muted" />
                <Badge variant="outline">{run.trigger === "weekly" ? "weekly" : "you asked"}</Badge>
                <span>{run.summary}</span>
              </span>
              {run.merged.map((m) => (
                <span
                  key={`${run.id}-${m.service}`}
                  className="flex min-w-0 flex-col gap-1 rounded-ob-md bg-ob-control-hover px-3 py-2"
                >
                  <span>
                    {m.blobIds.length} notes on {payeeName(m.service)} said it was mostly{" "}
                    {m.verdict} ({m.value}); now one note:{" "}
                    {m.noteBlobId ? <Hash value={m.noteBlobId} label="blob" /> : "being written"}
                  </span>
                  <span className="flex flex-wrap items-center gap-1 text-ob-muted">
                    merged and hidden (still on Walrus):
                    {m.blobIds.map((b) => (
                      <Hash key={b} value={b} label="blob" />
                    ))}
                  </span>
                </span>
              ))}
            </li>
          ))}
        </SettingsGroup>
      ) : t.data && !conflicts.length ? (
        <p className="text-md text-ob-muted">Nothing tidied yet.</p>
      ) : null}
    </div>
  );
}
