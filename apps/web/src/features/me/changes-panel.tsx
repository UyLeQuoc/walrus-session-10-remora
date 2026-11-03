import { Badge } from "@/components/ui/badge";
import { Section } from "@/features/me/section";
import { useChanges } from "@/features/me/use-changes";

export function ChangesPanel() {
  const { changes, loading, error } = useChanges();
  return (
    <Section title="How your memory changed" description="The newer fact wins. Walrus keeps both.">
      {loading ? <p className="text-md text-ob-muted">Reading your changes…</p> : null}
      {error ? <p className="text-md text-ob-danger-text">{error}</p> : null}
      {!loading && !error && changes.length === 0 ? (
        <p className="text-md text-ob-muted">No changes came back just now.</p>
      ) : null}
      <ol className="flex flex-col gap-4">
        {changes.map((change) => (
          <li key={change.blobId} className="flex flex-col gap-1 text-md">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-ob-muted">{change.date.slice(0, 10)}</span>
              <span className="min-w-0 flex-1 break-words" data-ux-skip>
                {change.text}
              </span>
            </div>
            {change.replaced ? (
              <div className="flex flex-wrap items-baseline gap-2 text-ob-muted">
                <span>{change.replaced.date.slice(0, 10)}</span>
                <s className="min-w-0 flex-1 break-words" data-ux-skip>
                  {change.replaced.text}
                </s>
                {change.replaced.certain ? null : <Badge variant="outline">probably</Badge>}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </Section>
  );
}
