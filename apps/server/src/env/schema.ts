/**
 * What the server needs from its environment, apart from reading it, so the
 * schema can be checked against `.env.example` in CI without a real `.env`.
 */
import { operatorEnvSchema } from "@remora/memory";
import { z } from "zod";

export const serverEnvSchema = operatorEnvSchema.extend({
  OPENROUTER_API_KEY: z.string().min(1),
  LLM_MODEL: z.string().default("google/gemini-2.5-flash"),
  LLM_FALLBACK_MODEL: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(8787),
  WEB_BASE_URL: z.string().url().default("http://localhost:5173"),
  CORS_ORIGIN: z.string().default("http://localhost:5173,http://localhost:5174"),
  SESSION_SECRET: z.string().min(32),
  KEY_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/),
  /** Optional WalForm (or any) feedback survey, shown on /start and /me. */
  SURVEY_URL: z.string().url().optional(),
  /** "off" starts only the web API, so several local servers never fight over one bot token. */
  CHANNELS: z.enum(["on", "off"]).default("on"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  DISCORD_TOKEN: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_APP_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  // Chain I/O per network (ADR-0015, ADR-0026). A network without its Tatum key is unavailable.
  TATUM_API_KEY: z.string().optional(),
  TATUM_API_KEY_TESTNET: z.string().optional(),
  TATUM_SUI_GRPC: z.string().url().optional(),
  TATUM_SUI_GRPC_TESTNET: z.string().url().optional(),
  /** The x402 facilitator + gas station per network (E3, D8). */
  FACILITATOR_URL: z.string().url().optional(),
  FACILITATOR_URL_TESTNET: z.string().url().optional(),
  /**
   * D2 worker, and the D1 checkpoint indexer. The indexer streams from Tatum the whole time it's on,
   * so it's off unless the one instance that indexes sets it (ADR-0058).
   */
  WORKER: z.enum(["on", "off"]).default("on"),
  INDEXER: z.enum(["on", "off"]).default("off"),
  /** The demo merchants behind the Reef (E7, E9). Without them Scout has nothing to buy. */
  MERCHANTS_URL: z.string().url().optional(),
  MERCHANTS_URL_TESTNET: z.string().url().optional(),
  MERCHANT_PAYTO: z.string().optional(),
  MERCHANT_PAYTO_TESTNET: z.string().optional(),
  /** D9: the cheaper model for Sonar checks and rule parsing. */
  LLM_SMALL_MODEL: z.string().optional(),
  REMORA_DAILY_TOKENS: z.coerce.number().int().positive().default(200_000),
  /**
   * D1 chain trigger for Sentinels. It streams from Tatum the whole time it's on, so it's off unless
   * the one instance that watches sets it; a forgotten local server spent a month's credits (ADR-0058).
   */
  WATCHER: z.enum(["on", "off"]).default("off"),
  /** A5: the bot's @username, for the t.me deep link. */
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  /** H7 (ADR-0051): the playground's funder (testnet only); unset = no playground. */
  PLAYGROUND_FUNDER_KEY: z.string().optional(),
  /** A separate Walrus Memory account for playground Scouts; unset = memory off for them. */
  PLAYGROUND_MEMWAL_ACCOUNT_ID: z.string().optional(),
  PLAYGROUND_MEMWAL_PRIVATE_KEY: z.string().optional(),
  PLAYGROUND_QUESTIONS: z.coerce.number().int().positive().default(3),
  PLAYGROUND_SESSIONS_PER_IP: z.coerce.number().int().positive().default(3),
  PLAYGROUND_POOL: z.coerce.number().int().positive().default(10),
  PLAYGROUND_TTL_MINUTES: z.coerce.number().int().positive().default(1440),
  /**
   * F14 (ADR-0066): where agents reach this server (`<API_BASE_URL>/mcp`). Unset = the origin of the
   * request that made the token, which is wrong behind a proxy that forwards only `/api`.
   */
  API_BASE_URL: z.string().url().optional(),
});
