import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { INVITE_LENGTH } from "@/features/team/invite-code";
import { TEAM_NAME_LENGTH } from "@/features/team/team-input";
import { useCreateTeam } from "@/features/team/use-create-team";
import { useJoinTeam } from "@/features/team/use-join-team";
import type { TeamInvite } from "@/features/team/use-team-invite";

export function TeamStart({
  onCreated,
  onJoined,
}: {
  onCreated: (invite: TeamInvite) => Promise<void>;
  onJoined: () => Promise<void>;
}) {
  return (
    <>
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>A team shares a memory that everyone in it recalls, in the chat and on every channel.</p>
        <p>
          Your own memory stays yours. Nothing you tell hippo is shared unless you add it to the
          team yourself, and the shared memory lives in hippo's account, not in yours.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <StartTeamCard onCreated={onCreated} />
        <JoinTeamCard onJoined={onJoined} />
      </div>
    </>
  );
}

function StartTeamCard({ onCreated }: { onCreated: (invite: TeamInvite) => Promise<void> }) {
  const create = useCreateTeam(onCreated);
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void create.submit();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start a team</CardTitle>
        <CardDescription>You get a code to invite the others.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field data-invalid={create.error ? true : undefined}>
            <FieldLabel htmlFor="team-name">Team name</FieldLabel>
            <Input
              id="team-name"
              value={create.name}
              maxLength={TEAM_NAME_LENGTH.max}
              autoComplete="off"
              placeholder="Platform"
              aria-invalid={create.error ? true : undefined}
              onChange={(event) => create.setName(event.target.value)}
            />
            <FieldDescription>
              {TEAM_NAME_LENGTH.min} to {TEAM_NAME_LENGTH.max} characters. Everyone in the team sees
              it.
            </FieldDescription>
            {create.error ? <FieldError>{create.error}</FieldError> : null}
          </Field>
          <Button type="submit" className="self-start" disabled={!create.valid || create.busy}>
            {create.busy ? "Starting…" : "Start the team"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function JoinTeamCard({ onJoined }: { onJoined: () => Promise<void> }) {
  const join = useJoinTeam(onJoined);
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void join.submit();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join a team</CardTitle>
        <CardDescription>Ask someone in the team for an invite code.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field data-invalid={join.error ? true : undefined}>
            <FieldLabel htmlFor="team-code">Invite code</FieldLabel>
            <Input
              id="team-code"
              value={join.draft}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="K7QX2M"
              aria-invalid={join.error ? true : undefined}
              onChange={(event) => join.setDraft(event.target.value)}
            />
            <FieldDescription>
              {INVITE_LENGTH} letters and digits. A code works once, for ten minutes.
            </FieldDescription>
            {join.error ? <FieldError>{join.error}</FieldError> : null}
          </Field>
          <Button type="submit" className="self-start" disabled={!join.valid || join.busy}>
            {join.busy ? "Joining…" : "Join the team"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
