import { randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { withLogContext } from "@remora/chain";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { discordAdapter } from "./channels/discord.ts";
import { slackAdapter } from "./channels/slack.ts";
import { telegramAdapter } from "./channels/telegram.ts";
import type { ChannelAdapter } from "./channels/types.ts";
import { env } from "./env/load.ts";
import { IDENTITY_HEADERS } from "./identity/names.ts";
import { checkAddress, clientAddress, isUnmetered, refusal } from "./iplimit.ts";
import { startMoneyRuntime } from "./money/index.ts";
import { playgroundJobs } from "./playground/index.ts";
import { registerRoutes } from "./routes/registry.ts";
import { onHatcheryEvents, remoraJobs, startRemoraRuntime } from "./runtime/index.ts";

const app = new Hono();
app.use(logger());
// K1 (ADR-0052): one id per request, taken from the caller or made, echoed back, and on every log line.
app.use("*", async (c, next) => {
  const id = c.req.header("x-request-id")?.slice(0, 64) || randomUUID();
  c.header("x-request-id", id);
  await withLogContext({ requestId: id }, next);
});
app.use(
  "/api/*",
  cors({
    origin: env.CORS_ORIGIN.split(",").map((o: string) => o.trim()),
    credentials: true,
    // A cross-origin client (Walrus Sites, say) carries its id in a header
    // because a SameSite=Lax cookie would not be sent. See routes/chat.ts.
    allowHeaders: [
      "content-type",
      ...IDENTITY_HEADERS,
      "x-remora-network",
      "x-remora-playground",
      "x-request-id",
    ],
    // Without this a cross-origin page cannot read the export's file name, and
    // every download is saved as the fallback "remora-memory.json".
    exposeHeaders: ["content-disposition", "x-request-id"],
  }),
);
/**
 * Applied to the routes that cost something, and never to health or config,
 * which an uptime check hits on a schedule and which spend nothing.
 */
app.use("/api/*", async (c, next) => {
  const path = c.req.path;
  if (isUnmetered(c.req.method, path)) return next();
  const gate = checkAddress(clientAddress(c.req.raw.headers));
  if (!gate.allowed) {
    const out = refusal(path, gate.message);
    return c.body(out.body, 429, {
      "content-type": out.contentType,
      "retry-after": String(gate.retryAfterSeconds),
    });
  }
  return next();
});

registerRoutes(app);

// A stray rejection used to end the process, and with it every channel and the
// web API: 22 times in a day from Telegram alone, against a restart policy that
// gives up after five. Log it, so `bun run ops` counts it, and stay up.
process.on("unhandledRejection", (reason) =>
  console.error("[process] unhandled rejection", reason),
);

// CHANNELS=off: only the web API. Telegram allows one poller per token, so extra
// local servers and agent worktrees run with channels off (docs/team-split.md §7).
const adapters =
  env.CHANNELS === "off"
    ? []
    : [telegramAdapter(), discordAdapter(), slackAdapter()].filter(
        (a): a is ChannelAdapter => a !== null,
      );
for (const a of adapters) a.start().catch((e) => console.error(`[${a.name}] failed to start`, e));
if (!adapters.length)
  console.log(
    env.CHANNELS === "off"
      ? "CHANNELS=off; only the web API is running"
      : "no channel tokens set; only the web API is running",
  );

const stopMoney = startMoneyRuntime(
  { ...remoraJobs, ...playgroundJobs },
  { onHatchery: onHatcheryEvents },
);
const stopRemoras = startRemoraRuntime();

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) =>
  console.log(`remora server on http://localhost:${info.port}`),
);

const shutdown = async () => {
  stopRemoras();
  await Promise.allSettled([...adapters.map((a) => a.stop()), stopMoney()]);
  server.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
