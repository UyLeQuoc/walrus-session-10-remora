export function FollowUpRow({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (text: string) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="flex flex-col items-start gap-3 px-2 pb-2">
      {suggestions.map((text) => (
        <button
          key={text}
          type="button"
          onClick={() => onPick(text)}
          className="text-left text-sm text-muted-foreground hover:text-primary"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
