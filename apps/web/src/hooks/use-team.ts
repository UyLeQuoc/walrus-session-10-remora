import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { apiGet } from "@/lib/api-request";

export const teamMemorySchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.enum(["pending", "stored", "failed"]),
  createdAt: z.string(),
  blobId: z.string().nullable(),
  explorerUrl: z.string().nullable(),
  mine: z.boolean(),
});

export const teamSchema = z.object({
  name: z.string(),
  memberCount: z.number(),
  memories: z.array(teamMemorySchema),
});

export const teamSummarySchema = teamSchema.pick({ name: true, memberCount: true });

const teamReply = z.object({
  known: z.boolean().default(true),
  team: teamSchema.nullable(),
});

export type TeamMemory = z.infer<typeof teamMemorySchema>;
export type Team = z.infer<typeof teamSchema>;

const LOAD_FAILED = "Could not load your team just now. Try again in a moment.";

export function useTeam() {
  const [team, setTeam] = useState<Team | null | undefined>(undefined);
  const [known, setKnown] = useState(true);
  const [error, setError] = useState("");
  const ticket = useRef(0);

  const reload = useCallback(async (): Promise<void> => {
    ticket.current += 1;
    const mine = ticket.current;
    const loaded = await apiGet("/api/me/team", teamReply, LOAD_FAILED);
    if (mine !== ticket.current) return;
    if (loaded.ok) {
      setTeam(loaded.data.team);
      setKnown(loaded.data.known);
      setError("");
    } else {
      setError(loaded.error);
    }
  }, []);

  useEffect(() => {
    void reload();
    return () => {
      ticket.current += 1;
    };
  }, [reload]);

  return { team, known, error, reload };
}
