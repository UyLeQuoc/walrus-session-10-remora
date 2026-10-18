import { useEffect, useState } from "react";
import { z } from "zod";
import { apiFetch } from "@/lib/api";

const usageReply = z.object({
  answers: z.number(),
  withMemory: z.number(),
  uses: z.record(z.string(), z.number()),
});

export type MemoryUsage = z.infer<typeof usageReply>;

export function usedInLabel(count: number): string {
  if (count === 0) return "not yet";
  return count === 1 ? "1 answer" : `${count} answers`;
}

export function useUsage(): MemoryUsage | null {
  const [usage, setUsage] = useState<MemoryUsage | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await apiFetch("/api/me/usage").catch(() => null);
      if (!res?.ok || cancelled) return;
      const body = usageReply.safeParse(await res.json().catch(() => null));
      if (body.success && !cancelled) setUsage(body.data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return usage;
}
