import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export interface ModelConfig {
  apiKey: string;
  model: string;
  fallbackModel?: string;
}

export function createModel(cfg: ModelConfig) {
  const openrouter = createOpenRouter({ apiKey: cfg.apiKey });
  return {
    id: cfg.model,
    primary: openrouter.chat(cfg.model),
    fallback: cfg.fallbackModel ? openrouter.chat(cfg.fallbackModel) : null,
  };
}
export type HippoModel = ReturnType<typeof createModel>;
