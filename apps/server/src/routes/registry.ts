import type { Hono } from "hono";
import { mcpRoutes } from "../mcp/index.ts";
import { moneyRoutes } from "../money/index.ts";
import { playgroundRoutes } from "../playground/index.ts";
import { hookRoutes, remoraRoutes } from "../runtime/index.ts";
import { authRoutes } from "./auth.ts";
import { chatRoutes } from "./chat.ts";
import { connectRoutes } from "./connect.ts";
import { conversationRoutes } from "./conversations.ts";
import { facilitatorRoutes } from "./facilitator.ts";
import { healthRoutes } from "./health.ts";
import { memoryRoutes } from "./memory.ts";

/**
 * Every route group the server mounts, in order. **Append-only**: add one import
 * and one line per new group, and never edit another domain's route file
 * (docs/team-split.md §9). Groups mount at "/" and carry their own paths.
 */
export const ROUTE_GROUPS = [
  healthRoutes,
  chatRoutes,
  conversationRoutes,
  memoryRoutes,
  connectRoutes,
  authRoutes,
  moneyRoutes,
  remoraRoutes,
  playgroundRoutes,
  mcpRoutes,
  facilitatorRoutes,
  hookRoutes,
] as const;

export function registerRoutes(app: Hono): void {
  for (const group of ROUTE_GROUPS) app.route("/", group);
}
