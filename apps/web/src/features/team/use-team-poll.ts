import { useCallback, useEffect, useRef, useState } from "react";
import { hasPending, POLL_EVERY_MS, shouldKeepPolling } from "@/features/team/team-poll";
import type { TeamMemory } from "@/hooks/use-team";

export function useTeamPoll(memories: TeamMemory[] | undefined, reload: () => Promise<void>) {
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const latest = useRef<TeamMemory[]>(memories ?? []);
  const pending = memories ? hasPending(memories) : false;

  useEffect(() => {
    latest.current = memories ?? [];
  }, [memories]);

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => {
      if (!shouldKeepPolling(latest.current, startedAt, Date.now())) {
        clearInterval(timer);
        return;
      }
      void reload();
    }, POLL_EVERY_MS);
    return () => clearInterval(timer);
  }, [pending, reload, startedAt]);

  const restart = useCallback(() => setStartedAt(Date.now()), []);

  return { restart };
}
