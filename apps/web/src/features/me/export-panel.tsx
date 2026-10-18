import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useExport } from "@/features/me/use-export";

export function ExportPanel({ onError }: { onError: (message: string) => void }) {
  const { busy, coverage, download } = useExport(onError);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Take it with you</CardTitle>
        <CardDescription>
          Every memory, read back from Walrus and checked against the hash hippo recorded.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy !== null} onClick={() => void download("md")}>
            {busy === "md" ? "Reading from Walrus…" : "Download to read (.md)"}
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={() => void download("json")}>
            {busy === "json" ? "Reading from Walrus…" : "Download the full record (.json)"}
          </Button>
        </div>
        {coverage && (
          <p className="text-sm text-muted-foreground">
            {coverage.memories} memories, text for {coverage.withText}, verified for{" "}
            <span className="font-medium text-foreground">{coverage.verified}</span>.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
