import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Markdown } from "@/features/chat/markdown";
import { Thinking } from "@/features/chat/streaming-text";
import type { Comparison } from "@/features/chat/use-compare";

export function WithoutMemory({ comparison }: { comparison: Comparison }) {
  switch (comparison.status) {
    case "loading":
      return <Thinking label="Answering without memory" />;
    case "failed":
      return <p className="text-sm text-destructive">{comparison.message}</p>;
    case "done":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Without Walrus memory</CardTitle>
            <CardDescription>
              The same conversation with memory off. Nothing was recalled or stored.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Markdown>{comparison.text}</Markdown>
          </CardContent>
        </Card>
      );
    default: {
      const unreachable: never = comparison;
      return unreachable;
    }
  }
}
