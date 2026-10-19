/**
 * The chat model catalog (Phase 6 §4): a snapshot of OpenRouter on 2026-10-19, prices in USD per
 * 1M tokens. Every entry supports tool calling and costs at most $1 per 1M tokens in and out. The Remora default (empty id) means "let the server
 * pick"; its id is never sent in the request body.
 */
export type ModelInput = "text" | "image" | "audio" | "video" | "file";

export type ChatModel = {
  /** OpenRouter id. Empty for the Remora default, which omits the field from the request. */
  id: string;
  label: string;
  shortLabel: string;
  vendor: string;
  inputPerMillion: number | null;
  outputPerMillion: number | null;
  inputs: ModelInput[];
};

export const DEFAULT_MODEL_ID = "";

export const MODELS: ChatModel[] = [
  {
    id: DEFAULT_MODEL_ID,
    label: "Remora default",
    shortLabel: "Remora",
    vendor: "Remora",
    inputPerMillion: null,
    outputPerMillion: null,
    inputs: ["text"],
  },
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
];

export const MODEL_INPUT_LABEL: Record<ModelInput, string> = {
  text: "Text",
  image: "Images",
  audio: "Audio/voice",
  video: "Video",
  file: "Files/PDF",
};

export function isKnownModelId(id: string | null): boolean {
  return id === DEFAULT_MODEL_ID || MODELS.some((model) => model.id === id);
}

/** The catalog entry, or the Remora default for an unknown id. */
export function modelById(id: string | null): ChatModel {
  return MODELS.find((model) => model.id === id) ?? (MODELS[0] as ChatModel);
}

export function priceLabel(model: ChatModel): string {
  if (model.inputPerMillion === null || model.outputPerMillion === null) return "—";
  return `$${model.inputPerMillion.toFixed(2)} / $${model.outputPerMillion.toFixed(2)}`;
}
