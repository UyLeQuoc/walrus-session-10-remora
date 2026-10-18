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
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  DISCORD_TOKEN: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_APP_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
});
