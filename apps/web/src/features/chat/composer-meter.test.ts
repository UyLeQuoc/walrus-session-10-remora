import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL_ID, formatContext, formatPrice, meterFor } from "./composer-meter";

describe("composer meter", () => {
  it("starts at zero for an empty draft", () => {
    const meter = meterFor({ modelId: DEFAULT_MODEL_ID, turns: [], draft: "" });
    expect(meter.label).toBe("Gemini 2.5 Flash");
    expect(meter.used).toBe(0);
    expect(formatContext(meter)).toBe("0 / 1M · 0%");
    expect(formatPrice(meter.priceUsd)).toBe("$0.00");
  });

  it("prices user text as input and assistant text as output", () => {
    const meter = meterFor({
      modelId: DEFAULT_MODEL_ID,
      turns: [{ role: "assistant", text: "a".repeat(4000) }],
      draft: "b".repeat(4000),
    });
    expect(meter.used).toBe(2000);
    expect(meter.priceUsd).toBeCloseTo((1000 * 0.3 + 1000 * 2.5) / 1_000_000);
    expect(formatPrice(meter.priceUsd)).toBe("$0.0028");
  });

  it("omits a price it has not measured", () => {
    const meter = meterFor({ modelId: "acme/unknown", turns: [], draft: "hello" });
    expect(meter.label).toBe("acme/unknown");
    expect(meter.percent).toBeNull();
    expect(formatPrice(meter.priceUsd)).toBe("—");
  });
});
