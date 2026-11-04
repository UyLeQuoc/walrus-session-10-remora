/** ADR-0121: a remora's hooks (`/api/remoras/:id/hooks…`), parsed like every other W2 call. */
import { HookEvent, OutHook } from "@remora/schema";
import { z } from "zod";
import { call } from "./api";

export const Delivery = z.object({
  id: z.string(),
  hookId: z.string(),
  type: z.string(),
  status: z.enum(["ok", "failed", "refused"]),
  code: z.number().nullable(),
  ms: z.number(),
  at: z.string(),
  attempt: z.number(),
  error: z.string().optional(),
});
export type Delivery = z.infer<typeof Delivery>;

export const PriceTriggerView = z.object({
  id: z.string(),
  symbol: z.string(),
  above: z.number().nullable(),
  below: z.number().nullable(),
  paused: z.boolean(),
  side: z.enum(["above", "below", "inside"]).nullable(),
  usd: z.number().nullable(),
  at: z.string().nullable(),
});
export type PriceTriggerView = z.infer<typeof PriceTriggerView>;

export const HooksView = z.object({
  /** Whether this kind wakes on a price or a webhook (Researchers and Briefers). */
  wakes: z.boolean(),
  inbound: z.array(z.object({ id: z.string(), name: z.string().nullable(), url: z.string() })),
  price: z.array(PriceTriggerView),
  out: z.array(OutHook),
  deliveries: z.array(Delivery),
  symbols: z.array(z.string()),
  events: z.array(HookEvent),
});
export type HooksView = z.infer<typeof HooksView>;

const Revealed = z.object({
  hook: z.object({
    id: z.string(),
    name: z.string().nullable(),
    url: z.string(),
    secret: z.string(),
  }),
});
const Ok = z.object({ ok: z.literal(true) });
const Secret = z.object({ secret: z.string() });

export const hooksApi = {
  view: (id: string) => call("GET", `/api/remoras/${id}/hooks`, HooksView),
  addWebhook: (id: string, name?: string) =>
    call("POST", `/api/remoras/${id}/hooks/in`, Revealed, name ? { name } : {}),
  webhookSecret: (id: string, hookId: string) =>
    call("GET", `/api/remoras/${id}/hooks/in/${hookId}/secret`, Revealed),
  rotateWebhook: (id: string, hookId: string) =>
    call("POST", `/api/remoras/${id}/hooks/in/${hookId}/rotate`, Revealed),
  removeWebhook: (id: string, hookId: string) =>
    call("DELETE", `/api/remoras/${id}/hooks/in/${hookId}`, Ok),
  addPrice: (id: string, b: { symbol: string; above?: number; below?: number }) =>
    call("POST", `/api/remoras/${id}/hooks/price`, z.object({ trigger: z.object({}).loose() }), b),
  pausePrice: (id: string, triggerId: string, paused: boolean) =>
    call(
      "PATCH",
      `/api/remoras/${id}/hooks/price/${triggerId}`,
      z.object({ trigger: z.object({}).loose() }),
      { paused },
    ),
  removePrice: (id: string, triggerId: string) =>
    call("DELETE", `/api/remoras/${id}/hooks/price/${triggerId}`, Ok),
  addOut: (id: string, b: { url: string; events: HookEvent[] }) =>
    call("POST", `/api/remoras/${id}/hooks/out`, z.object({ hook: OutHook }), b),
  removeOut: (id: string, hookId: string) =>
    call("DELETE", `/api/remoras/${id}/hooks/out/${hookId}`, Ok),
  outSecret: (id: string) => call("GET", `/api/remoras/${id}/hooks/out/secret`, Secret),
  rotateOutSecret: (id: string) => call("POST", `/api/remoras/${id}/hooks/out/rotate`, Secret),
  testOut: (id: string, hookId: string) =>
    call("POST", `/api/remoras/${id}/hooks/out/${hookId}/test`, z.object({ delivery: Delivery })),
};
