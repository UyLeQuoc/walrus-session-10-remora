import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Section } from "@/features/me/section";
import { useImport } from "@/features/me/use-import";

export function ImportPanel({ onSaved }: { onSaved: () => void }) {
  const importer = useImport(onSaved);
  const kept = importer.facts.filter((fact) => fact.keep).length;
  return (
    <Section
      title="Bring your memory from another assistant"
      description="Paste what another assistant knows about you. hippo keeps only the facts you tick."
    >
      <Textarea
        aria-label="What another assistant knows about you"
        placeholder="Ask the other assistant: “Tell me everything you remember about me.” Paste its answer here."
        value={importer.text}
        onChange={(event) => importer.setText(event.target.value)}
      />
      <Button
        type="button"
        className="self-start"
        disabled={importer.finding || importer.text.trim().length < 10}
        onClick={() => void importer.find()}
      >
        {importer.finding ? "Reading…" : "Find facts"}
      </Button>
      {importer.facts.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {importer.facts.map((fact, index) => (
            <li key={`${fact.type}-${fact.text}`} className="flex items-start gap-2 text-sm">
              <Checkbox
                aria-label={`Keep: ${fact.text}`}
                checked={fact.keep}
                onCheckedChange={() => importer.toggle(index)}
              />
              <Badge variant="outline">{fact.type}</Badge>
              <span className="min-w-0 flex-1 break-words">{fact.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {importer.facts.length > 0 ? (
        <Button
          type="button"
          className="self-start"
          disabled={importer.saving || kept === 0}
          onClick={() => void importer.save()}
        >
          {importer.saving ? "Keeping…" : `Remember ${kept} ${kept === 1 ? "fact" : "facts"}`}
        </Button>
      ) : null}
      {importer.message ? (
        <p className="text-sm text-muted-foreground">{importer.message}</p>
      ) : null}
      {importer.error ? <p className="text-sm text-destructive">{importer.error}</p> : null}
    </Section>
  );
}
