/** HTTP surface of the facilitator: `/supported`, `/verify`, `/settle` (x402) and `/gas` (gas station). */
import type { PaymentPayload, PaymentRequirements } from "@remora/disc-sdk";
import { Hono } from "hono";
import { type Facilitator, GasStationError } from "./facilitator.ts";

export function createFacilitatorApp(f: Facilitator) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));
  app.get("/supported", (c) => c.json(f.supported()));

  app.post("/verify", async (c) => {
    const body = await c.req.json<{
      paymentPayload: PaymentPayload;
      paymentRequirements: PaymentRequirements;
    }>();
    return c.json(await f.verify(body.paymentPayload, body.paymentRequirements));
  });

  app.post("/settle", async (c) => {
    const body = await c.req.json<{
      paymentPayload: PaymentPayload;
      paymentRequirements: PaymentRequirements;
    }>();
    return c.json(await f.settle(body.paymentPayload, body.paymentRequirements));
  });

  app.post("/gas", async (c) => {
    const body = await c.req.json<{ network: string; sender: string; transactionKind: string }>();
    try {
      return c.json(await f.gas(body));
    } catch (err) {
      if (err instanceof GasStationError) {
        return c.json({ error: { code: err.code, message: err.message } }, 400);
      }
      throw err;
    }
  });

  return app;
}
