import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function CitationNote({ note, onRetry }: { note: string; onRetry: (() => void) | null }) {
  if (!note) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-2" role="status">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {onRetry ? null : <Spinner aria-hidden className="size-4" />}
        {note}
      </p>
      {onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
