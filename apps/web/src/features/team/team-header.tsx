import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { joinCommand } from "@/features/team/invite-code";
import type { TeamInvite } from "@/features/team/use-team-invite";
import { membersLabel } from "@/hooks/team-counts";
import type { Team } from "@/hooks/use-team";

export function TeamHeader({
  team,
  invite,
  inviteBusy,
  inviteError,
  onInvite,
}: {
  team: Team;
  invite: TeamInvite | null;
  inviteBusy: boolean;
  inviteError: string;
  onInvite: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="min-w-0 wrap-anywhere">{team.name}</CardTitle>
        <CardDescription>
          {membersLabel(team.memberCount)}. The shared memory lives in hippo's account, so no member
          owns it yet.
        </CardDescription>
        <CardAction>
          <Button variant="outline" disabled={inviteBusy} onClick={onInvite}>
            {inviteBusy ? "Making a code…" : "Invite"}
          </Button>
        </CardAction>
      </CardHeader>
      {invite || inviteError ? (
        <CardContent className="flex flex-col gap-2">
          {invite ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <code className="rounded bg-muted px-2 py-1 font-mono text-base tracking-widest">
                {invite.code}
              </code>
              <CopyButton value={joinCommand(invite.code)} label="join command" />
              <span className="text-muted-foreground">
                works once, for {invite.expiresInMinutes} minutes, on any channel
              </span>
            </div>
          ) : null}
          {inviteError ? <p className="text-sm text-destructive">{inviteError}</p> : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
