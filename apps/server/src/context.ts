import { createModel, type HippoModel } from "@remora/core";
import { createDb } from "@remora/db";
import { isCatalogModel } from "@remora/schema";
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

const chosen = new Map<string, HippoModel>();

/**
 * D9 (ADR-0042): the model a request asked for, if it is in the shared catalog; otherwise the default.
 * A chosen model falls back to the default model when it fails.
 */
export function modelFor(id: string | null | undefined): HippoModel {
  if (!isCatalogModel(id)) return model;
  let m = chosen.get(id);
  if (!m) {
    m = createModel({ apiKey: env.OPENROUTER_API_KEY, model: id, fallbackModel: env.LLM_MODEL });
    chosen.set(id, m);
  }
  return m;
}
