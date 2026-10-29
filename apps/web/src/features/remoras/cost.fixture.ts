/** Local fixtures for the N15 cost response. TODO: replace with the schema fixtures (see `cost.ts`). */
import type { CostResponse } from "./cost";

/** A normal month: the model is most of it. */
export const COST_NORMAL: CostResponse = {
  llmUsdc: "1250000",
  gasUsdc: "180000",
  purchasesUsdc: "570000",
};

export const COST_EMPTY: CostResponse = { llmUsdc: "0", gasUsdc: "0", purchasesUsdc: "0" };

/** Purchases dominate; the model and gas are real but tiny (under a cent). */
export const COST_PURCHASES: CostResponse = {
  llmUsdc: "3000",
  gasUsdc: "0",
  purchasesUsdc: "4500000",
};
