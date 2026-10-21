import { MODEL_CATALOG } from "@remora/schema";

/**
 * The chat model catalog (Phase 6 §4): a snapshot of OpenRouter on 2026-10-19, prices in USD per
 * 1M tokens. The entries live in `packages/schema` so the server allowlists the same ids. Every entry supports tool calling and costs at most $1 per 1M tokens in and out. The Remora default (empty id) means "let the server
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

/** The Remora default, then the shared catalog (`packages/schema` MODEL_CATALOG, ADR-0042). */
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
  ...MODEL_CATALOG.map((m) => ({ ...m, inputs: [...m.inputs] })),
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
