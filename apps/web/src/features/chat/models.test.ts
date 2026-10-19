/** The chat model catalog (Phase 6 §4): the snapshot the picker renders. */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODEL_ID,
  isKnownModelId,
  MODEL_INPUT_LABEL,
  MODELS,
  modelById,
  priceLabel,
} from "./models";

describe("the model catalog", () => {
  it("has the Remora default first and one entry per OpenRouter id", () => {
    expect(MODELS[0]?.id).toBe(DEFAULT_MODEL_ID);
    expect(MODELS).toHaveLength(6);
    expect(new Set(MODELS.map((m) => m.id)).size).toBe(6);
  });

  it("counts the input kinds for the badge", () => {
    expect(modelById("qwen/qwen3.8-omni-flash").inputs).toHaveLength(4);
    expect(modelById("anthropic/claude-haiku-5.5").inputs).toHaveLength(3);
    expect(modelById(DEFAULT_MODEL_ID).inputs).toEqual(["text"]);
    for (const model of MODELS) {
      for (const input of model.inputs) expect(MODEL_INPUT_LABEL[input]).toBeTruthy();
    }
  });

  it("shows the price per 1M, and a dash for the server default", () => {
    expect(priceLabel(modelById("deepseek/deepseek-v4.1-flash"))).toBe("$0.04 / $0.08");
    expect(priceLabel(modelById(DEFAULT_MODEL_ID))).toBe("—");
  });

  it("lists only models that cost at most $1 per 1M in and out", () => {
    for (const model of MODELS.slice(1)) {
      expect(model.inputPerMillion).toBeLessThanOrEqual(1);
      expect(model.outputPerMillion).toBeLessThanOrEqual(1);
    }
  });

  it("falls back to the default for an id the catalog no longer knows", () => {
    expect(modelById("gone/model").id).toBe(DEFAULT_MODEL_ID);
    expect(isKnownModelId("gone/model")).toBe(false);
    expect(isKnownModelId(null)).toBe(false);
  });
});
