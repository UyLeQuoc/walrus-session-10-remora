/**
 * The model catalog (D9, ADR-0042): the models a remora or the chat may run on. A snapshot of
 * OpenRouter on 2026-10-19 (Huấn's picker, Phase 6 §4), prices in USD per 1M tokens. Every entry
 * supports tool calling and costs at most $1 per 1M tokens in and out. An absent model means the
 * server's default (`LLM_MODEL`).
 */
import { z } from "zod";

export const ModelInput = z.enum(["text", "image", "audio", "video", "file"]);

export const ModelInfo = z.object({
  /** OpenRouter id. */
  id: z.string().min(1),
  label: z.string().min(1),
  shortLabel: z.string().min(1),
  vendor: z.string().min(1),
  inputPerMillion: z.number().nonnegative().max(1),
  outputPerMillion: z.number().nonnegative().max(1),
  inputs: z.array(ModelInput).min(1),
});

export const MODEL_CATALOG = [
  {
    id: "deepseek/deepseek-v4.1-flash",
    label: "DeepSeek V4.1 Flash",
    shortLabel: "V4.1 Flash",
    vendor: "DeepSeek",
    inputPerMillion: 0.04,
    outputPerMillion: 0.08,
    inputs: ["text", "image"],
  },
  {
    id: "z-ai/glm-5.3-flash",
    label: "GLM-5.3 Flash",
    shortLabel: "GLM-5.3",
    vendor: "Zhipu",
    inputPerMillion: 0.05,
    outputPerMillion: 0.16,
    inputs: ["text", "image", "video"],
  },
  {
    id: "anthropic/claude-haiku-5.5",
    label: "Claude Haiku 5.5",
    shortLabel: "Haiku 5.5",
    vendor: "Anthropic",
    inputPerMillion: 0.1,
    outputPerMillion: 0.5,
    inputs: ["text", "image", "file"],
  },
  {
    id: "openai/gpt-6-luna",
    label: "GPT-6 Luna",
    shortLabel: "Luna",
    vendor: "OpenAI",
    inputPerMillion: 0.1,
    outputPerMillion: 0.5,
    inputs: ["text", "image", "file"],
  },
  {
    id: "qwen/qwen3.8-omni-flash",
    label: "Qwen3.8 Omni Flash",
    shortLabel: "Omni Flash",
    vendor: "Alibaba",
    inputPerMillion: 0.15,
    outputPerMillion: 0.47,
    inputs: ["text", "image", "audio", "video"],
  },
] as const satisfies readonly z.input<typeof ModelInfo>[];

export const MODEL_IDS = MODEL_CATALOG.map((m) => m.id);

/** True for a catalog id. Anything else runs on the server default. */
export const isCatalogModel = (id: string | null | undefined): id is (typeof MODEL_IDS)[number] =>
  !!id && (MODEL_IDS as readonly string[]).includes(id);

export type ModelInput = z.infer<typeof ModelInput>;
export type ModelInfo = z.infer<typeof ModelInfo>;
