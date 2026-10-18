import { useCallback } from "react";
import { type TeamInvite, useTeamInvite } from "@/features/team/use-team-invite";
import { useTeamPoll } from "@/features/team/use-team-poll";
import { useTeam } from "@/hooks/use-team";

export function useTeamPage() {
  const { team, known, error, reload } = useTeam();
  const invite = useTeamInvite();
  const { show, clear } = invite;
  const { restart } = useTeamPoll(team?.memories, reload);

  const created = useCallback(
    async (next: TeamInvite) => {
      show(next);
      await reload();
    },
    [reload, show],
  );

  const remembered = useCallback(async () => {
    restart();
    await reload();
  }, [reload, restart]);

  const left = useCallback(async () => {
    clear();
    await reload();
  }, [clear, reload]);

  return { team, known, error, invite, created, joined: reload, remembered, left };
}
