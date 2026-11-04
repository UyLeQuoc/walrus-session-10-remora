/**
 * N11 (ADR-0122): Settings → History. Every change is a version; Compare shows a version against now,
 * field by field, and Restore brings it back (a signature for the spending limit and the payees).
 */
import type { ConfigFieldDiff, RemoraView } from "@remora/schema";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/app/confirm-action";
import { Section } from "@/components/app/page";
import { Time } from "@/components/app/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsGroup, SettingsRow } from "@/openbot/pages";
import { restorePlan, valueLine } from "./history";
import { useConfigHistory } from "./use-history";

const SHOWN = 6;

function Changes({ changes }: { changes: ConfigFieldDiff[] }) {
  if (!changes.length) return <p className="text-md text-ob-muted">Same as now.</p>;
  return (
    <dl className="flex flex-col gap-2 text-md" data-testid="history-diff">
      {changes.map((c) => (
        <div key={c.field} className="grid gap-1 sm:grid-cols-[9rem_1fr]" data-field={c.field}>
          <dt className="text-ob-secondary">
            {c.label}
            {c.restore === "signature" ? (
              <Badge variant="outline" className="ml-2">
                signature
              </Badge>
            ) : null}
          </dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0 break-words text-ob-muted line-through decoration-ob-border-strong">
              {valueLine(c.field, c.current)}
            </span>
            <ArrowRight className="size-3.5 shrink-0 text-ob-muted" aria-label="becomes" />
            <span className="min-w-0 break-words text-ob-text">
              {valueLine(c.field, c.version)}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function HistorySection({
  r,
  reload,
  readOnly = false,
}: {
  r: RemoraView;
  reload: () => void;
  readOnly?: boolean;
}) {
  const h = useConfigHistory(r, reload);
  const [all, setAll] = useState(false);
  const list = h.versions.data?.versions ?? [];
  const diff = h.diff.data;
  return (
    <Section
      layout="split"
      title="History"
      description="Every change is a version you can go back to."
    >
      {h.versions.error ? <p className="text-md text-ob-danger-text">{h.versions.error}</p> : null}
      {h.versions.loading && !h.versions.data ? (
        <Skeleton className="h-24 w-full rounded-ob-card" />
      ) : null}
      {list.length ? (
        <SettingsGroup as="ul" data-testid="history">
          {(all ? list : list.slice(0, SHOWN)).map((v) => (
            <li key={v.id} data-testid="history-version" className="flex flex-col">
              <SettingsRow
                stack
                title={
                  <span className="inline-flex items-center gap-2">
                    Revision {v.revision}
                    {v.current ? <Badge variant="secondary">Now</Badge> : null}
                  </span>
                }
                description={
                  <>
                    {v.summary} · <Time value={v.at} />
                  </>
                }
                actions={
                  v.current ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      aria-expanded={h.open === v.id}
                      onClick={() => h.setOpen(h.open === v.id ? null : v.id)}
                    >
                      {h.open === v.id ? "Hide" : "Compare"}
                    </Button>
                  )
                }
              />
              {h.open === v.id ? (
                <div className="flex flex-col gap-3 px-4 pb-4">
                  {h.diff.error ? (
                    <p className="text-md text-ob-danger-text">{h.diff.error}</p>
                  ) : diff?.version.id !== v.id ? (
                    <Skeleton className="h-12 w-full" />
                  ) : (
                    <>
                      <Changes changes={diff.changes} />
                      {!readOnly && diff.changes.length ? (
                        <ConfirmAction
                          trigger={
                            <Button type="button" variant="outline" className="w-fit">
                              Restore revision {v.revision}
                            </Button>
                          }
                          title={`Restore revision ${v.revision}?`}
                          description={restorePlan(diff.changes)}
                          confirmLabel="Restore"
                          tone="default"
                          onConfirm={async () => {
                            toast.success(await h.restore(v.id));
                          }}
                        />
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </SettingsGroup>
      ) : null}
      {list.length > SHOWN ? (
        <Button type="button" variant="ghost" className="w-fit" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${list.length}`}
        </Button>
      ) : null}
    </Section>
  );
}
