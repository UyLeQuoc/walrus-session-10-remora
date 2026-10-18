import { TriangleAlert } from "lucide-react";
import type { FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { TEAM_FACT_LENGTH } from "@/features/team/team-input";
import { useTeamRemember } from "@/features/team/use-team-remember";
import { cn } from "@/lib/utils";

export function TeamAdd({ onRemembered }: { onRemembered: () => Promise<void> }) {
  const remember = useTeamRemember(onRemembered);
  const over = remember.length > TEAM_FACT_LENGTH.max;
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void remember.submit();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add to the team</CardTitle>
        <CardDescription>
          One fact the whole team should know: a decision, a gotcha, how something is done.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field data-invalid={remember.error ? true : undefined}>
            <FieldLabel htmlFor="team-fact">What the team should remember</FieldLabel>
            <Textarea
              id="team-fact"
              value={remember.text}
              placeholder="Staging deploys freeze every Friday at 16:00."
              aria-invalid={remember.error || over ? true : undefined}
              onChange={(event) => remember.setText(event.target.value)}
            />
            <FieldDescription className={cn(over && "text-destructive")}>
              {remember.length} / {TEAM_FACT_LENGTH.max}
            </FieldDescription>
            {remember.error ? <FieldError>{remember.error}</FieldError> : null}
          </Field>
          <Alert>
            <TriangleAlert />
            <AlertDescription>
              Everyone in the team will recall this, and it cannot be taken back: a memory on Walrus
              cannot be deleted, and leaving the team does not remove it.
            </AlertDescription>
          </Alert>
          <Button type="submit" className="self-start" disabled={!remember.valid || remember.busy}>
            {remember.busy ? "Adding…" : "Add to the team"}
          </Button>
          {remember.message ? (
            <p className="text-sm text-muted-foreground">{remember.message}</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
