/** F14 (ADR-0066): MCP v2 wired to the real runtime. Tests build `createMcpRoutes` with fakes. */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { eq, remoras } from "@remora/db";
import { env } from "../env/load.ts";
import { signedInOwner } from "../identity/session.ts";
import { NETWORK_HEADER, resolveNetwork } from "../money/networks.ts";
import { remoraService, runtime } from "../runtime/index.ts";
import { createMcpRoutes } from "./routes.ts";
import { authenticate, recordCall } from "./tokens.ts";
import { createMcpTools } from "./tools.ts";

const bin = fileURLToPath(new URL("../../../../packages/mcp/src/bin.ts", import.meta.url));

export const mcpRoutes = createMcpRoutes({
  db: runtime.db,
  log: runtime.log,
  limiter: runtime.limiter,
  tools: createMcpTools({ rt: runtime, config: (r) => remoraService.config(r) }),
  owner: async (c) => (await signedInOwner(c))?.owner ?? null,
  network: (c) => resolveNetwork(runtime.networks, c.req.header(NETWORK_HEADER)),
  remoraFor: (id, owner) => remoraService.get(id, owner),
  remoraById: async (id) => {
    const [r] = await runtime.db.select().from(remoras).where(eq(remoras.id, id));
    return r ?? null;
  },
  apiBase: (c) => (env.API_BASE_URL ?? new URL(c.req.url).origin).replace(/\/$/, ""),
  // From a clone of the repo the stdio server is here; a deployed server can't know the reader's path.
  stdioBin: existsSync(bin) ? bin : "<path to remora>/packages/mcp/src/bin.ts",
  allowedOrigins: env.CORS_ORIGIN.split(",").map((o: string) => o.trim()),
  authenticate: (secret) => authenticate(runtime.db, secret),
  record: (tokenId, call) => recordCall(runtime.db, tokenId, call),
});
