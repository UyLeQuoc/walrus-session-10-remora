import { Button } from "@/components/ui/button";

export function FollowUpRow({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (text: string) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="flex flex-col items-start gap-1 px-2 pb-2">
      {suggestions.map((text) => (
        <Button
          key={text}
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto justify-start px-1 py-1 text-left font-normal text-muted-foreground hover:text-foreground"
          onClick={() => onPick(text)}
        >
          {text}
        </Button>
      ))}
    </div>
  );
}
