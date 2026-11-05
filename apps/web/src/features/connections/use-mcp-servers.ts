/**
 * ADR-0143: one remora's read-only MCP servers and the owner's actions on them. Each action reloads
 * the list; the token typed in is sent once and never comes back.
 */
import type { McpServerView } from "@remora/schema";
import { useState } from "react";
import type { Result } from "@/features/remoras/api";
import { useLoad } from "@/features/remoras/hooks";
import { mcpServers } from "./api";

const NONE: Result<{ servers: McpServerView[] }> = { ok: true, data: { servers: [] } };

/** The ticked tools after one box changes. */
export const withTool = (ticked: string[], tool: string, on: boolean) =>
  on ? [...new Set([...ticked, tool])] : ticked.filter((t) => t !== tool);

export function useMcpServers(remoraId: string) {
  const list = useLoad(
    () => (remoraId ? mcpServers.list(remoraId) : Promise.resolve(NONE)),
    [remoraId],
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const act = async <T>(key: string, fn: () => Promise<Result<T>>) => {
    setBusy(key);
    setError("");
    const out = await fn();
    setBusy("");
    if (!out.ok) {
      setError(out.error);
      return false;
    }
    void list.refresh();
    return true;
  };

  return {
    servers: list.data?.servers ?? [],
    loading: list.loading,
    loadError: list.error,
    refresh: list.refresh,
    busy,
    error,
    add: (input: { url: string; name?: string; token?: string }) =>
      act("add", () =>
        mcpServers.add(remoraId, {
          url: input.url.trim(),
          ...(input.name?.trim() ? { name: input.name.trim() } : {}),
          ...(input.token?.trim() ? { token: input.token.trim() } : {}),
        }),
      ),
    toggle: (s: McpServerView, tool: string, on: boolean) =>
      act(`tick:${s.id}`, () => mcpServers.tick(remoraId, s.id, withTool(s.tools, tool, on))),
    /** For ConfirmAction: throws the sentence when it fails. */
    remove: async (s: McpServerView) => {
      const out = await mcpServers.remove(remoraId, s.id);
      if (!out.ok) throw new Error(out.error);
      void list.refresh();
    },
  };
}
