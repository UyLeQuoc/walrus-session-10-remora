import { createModel } from "@remora/core";
import { createDb } from "@remora/db";
import { env } from "./env/load.ts";

export const db = createDb(env.DATABASE_URL);
export const model = createModel({
  apiKey: env.OPENROUTER_API_KEY,
  model: env.LLM_MODEL,
  fallbackModel: env.LLM_FALLBACK_MODEL,
});
export const operator = {
  key: env.MEMWAL_PRIVATE_KEY,
  accountId: env.MEMWAL_ACCOUNT_ID,
  serverUrl: env.MEMWAL_SERVER_URL,
};
