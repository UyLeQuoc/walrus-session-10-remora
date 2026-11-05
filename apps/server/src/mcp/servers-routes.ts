/**
 * ADR-0143's owner routes, mounted on the W2 app so they share its wallet session, its id check and
 * its error sentences. None of them returns a token: a view says only whether one is set.
 */
import type { SuiNetwork } from "@remora/chain";
import type { Context } from "hono";
import { z } from "zod";
import type { RuntimeDeps } from "../runtime/deps.ts";
import type { OwnerApp } from "../runtime/ledger-routes.ts";
import { RemoraError, type RemoraService } from "../runtime/remoras.ts";
import { addServer, listServers, removeServer, tickTools } from "./servers.ts";

const NO_STORE = { "cache-control": "no-store" };
const SERVER_ID = /^[0-9a-f]{12}$/;

const AddInput = z.object({
  url: z.string().trim().min(1).max(500),
  name: z.string().trim().max(40).optional(),
  token: z.string().trim().max(4_096).optional(),
});
const TickInput = z.object({ tools: z.array(z.string().min(1).max(120)).max(50) });

const parsed = <T>(schema: z.ZodType<T>, v: unknown): T => {
  const out = schema.safeParse(v);
  if (!out.success) throw new RemoraError("mcp.bad_input", "That request isn't right.");
  return out.data;
};

export function mountMcpServers(
  app: OwnerApp,
  d: { service: RemoraService; runtime: RuntimeDeps },
) {
  const rt = d.runtime;
  const mine = (c: Context<{ Variables: { owner: string; network: SuiNetwork } }>) =>
    d.service.get(c.req.param("id") ?? "", c.get("owner"));
  const serverId = (c: Context) => {
    const id = c.req.param("serverId") ?? "";
    if (!SERVER_ID.test(id)) throw new RemoraError("mcp.not_found", "No such MCP server.", 404);
    return id;
  };
  const body = async (c: Context): Promise<unknown> => c.req.json().catch(() => ({}));

  app.get("/api/remoras/:id/mcp", async (c) =>
    c.json({ servers: listServers(await mine(c)) }, 200, NO_STORE),
  );

  app.post("/api/remoras/:id/mcp", async (c) => {
    const input = parsed(AddInput, await body(c));
    return c.json({ server: await addServer(rt, await mine(c), input) }, 201, NO_STORE);
  });

  app.put("/api/remoras/:id/mcp/:serverId/tools", async (c) => {
    const { tools } = parsed(TickInput, await body(c));
    return c.json(
      { server: await tickTools(rt, await mine(c), serverId(c), tools) },
      200,
      NO_STORE,
    );
  });

  app.delete("/api/remoras/:id/mcp/:serverId", async (c) => {
    await removeServer(rt, await mine(c), serverId(c));
    return c.json({ ok: true });
  });
}
