/**
 * List rates from docs/evidence/model-bakeoff-2026-09-23.md. Gemini's window is
 * the published 1,048,576. A model with no measured rate shows no price.
 */
const MODEL_METERS = {
  "google/gemini-2.5-flash": {
    label: "Gemini 2.5 Flash",
    contextTokens: 1_048_576,
    inputPerMillion: 0.3,
    outputPerMillion: 2.5,
  },
  "qwen/qwen3.7-flash": {
    label: "Qwen 3.7 Flash",
    contextTokens: null,
    inputPerMillion: 0.03,
    outputPerMillion: 0.13,
  },
  "deepseek/deepseek-v4-flash": {
    label: "DeepSeek V4 Flash",
    contextTokens: null,
    inputPerMillion: 0.089,
    outputPerMillion: 0.177,
  },
  // OpenRouter list price for V4.1, checked 2026-09-29. Not the V4 bakeoff rate.
  "deepseek/deepseek-v4.1-flash": {
    label: "DeepSeek V4.1 Flash",
    contextTokens: 1_048_576,
    inputPerMillion: 0.3,
    outputPerMillion: 1.2,
  },
} as const;

export const DEFAULT_MODEL_ID = "google/gemini-2.5-flash";

export type ComposerMeter = {
  label: string;
  used: number;
  window: number | null;
  percent: number | null;
  priceUsd: number | null;
};

type Turn = { role: string; text: string };

export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.ceil(trimmed.length / 4);
}

export function meterFor(input: {
  modelId: string;
  turns: readonly Turn[];
  draft: string;
}): ComposerMeter {
  const known = MODEL_METERS[input.modelId as keyof typeof MODEL_METERS];
  let inputTokens = estimateTokens(input.draft);
  let outputTokens = 0;
  for (const turn of input.turns) {
    const tokens = estimateTokens(turn.text);
    if (turn.role === "assistant") outputTokens += tokens;
    else inputTokens += tokens;
  }
  const used = inputTokens + outputTokens;
  const window = known?.contextTokens ?? null;
  const percent = window ? Math.min(100, (used / window) * 100) : null;
  const priceUsd =
    known == null
      ? null
      : (inputTokens * known.inputPerMillion + outputTokens * known.outputPerMillion) / 1_000_000;
  return {
    label: known?.label ?? input.modelId,
    used,
    window,
    percent,
    priceUsd,
  };
}

function compactCount(n: number): string {
  if (n >= 1_000_000) {
    const millions = Math.round((n / 1_000_000) * 10) / 10;
    return `${Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
  return n.toLocaleString("en-US");
}

export function formatPercent(percent: number): string {
  if (percent === 0) return "0%";
  if (percent < 0.1) return "<0.1%";
  if (percent < 10) return `${percent.toFixed(1)}%`;
  return `${Math.round(percent)}%`;
}

export function formatContext(meter: ComposerMeter): string {
  const used = compactCount(meter.used);
  if (meter.window == null || meter.percent == null) return used;
  return `${used} / ${compactCount(meter.window)} · ${formatPercent(meter.percent)}`;
}

export function formatPrice(usd: number | null): string {
  if (usd == null) return "—";
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
