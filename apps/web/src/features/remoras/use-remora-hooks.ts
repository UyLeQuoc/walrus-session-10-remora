/**
 * ADR-0121: the Hooks card's data and actions. Each action reloads the view; a revealed secret stays
 * in memory on this page only, keyed by the webhook's id (`out` for the outbound signing secret).
 */
import type { HookEvent } from "@remora/schema";
import { useState } from "react";
import type { Result } from "./api";
import { useLoad } from "./hooks";
import { type Delivery, hooksApi } from "./hooks-api";

export const OUT_SECRET = "out";

export function useRemoraHooks(remoraId: string) {
  const view = useLoad(() => hooksApi.view(remoraId), [remoraId]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [tested, setTested] = useState<Delivery | null>(null);

  const reveal = (key: string, secret: string) => setSecrets((s) => ({ ...s, [key]: secret }));
  const act = async <T>(key: string, fn: () => Promise<Result<T>>, then?: (data: T) => void) => {
    setBusy(key);
    setError("");
    const out = await fn();
    setBusy("");
    if (!out.ok) {
      setError(out.error);
      return false;
    }
    then?.(out.data);
    void view.refresh();
    return true;
  };

  return {
    view: view.data,
    loadError: view.error,
    busy,
    error,
    secrets,
    tested,
    hide: (key: string) =>
      setSecrets((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== key))),
    addWebhook: (name?: string) =>
      act(
        "in:add",
        () => hooksApi.addWebhook(remoraId, name),
        (d) => reveal(d.hook.id, d.hook.secret),
      ),
    revealWebhook: (hookId: string) =>
      act(
        `in:${hookId}`,
        () => hooksApi.webhookSecret(remoraId, hookId),
        (d) => reveal(d.hook.id, d.hook.secret),
      ),
    rotateWebhook: (hookId: string) =>
      act(
        `in:${hookId}`,
        () => hooksApi.rotateWebhook(remoraId, hookId),
        (d) => reveal(d.hook.id, d.hook.secret),
      ),
    removeWebhook: (hookId: string) =>
      act(`in:${hookId}`, () => hooksApi.removeWebhook(remoraId, hookId)),
    addPrice: (symbol: string, side: "above" | "below", threshold: number) =>
      act("price:add", () => hooksApi.addPrice(remoraId, { symbol, [side]: threshold })),
    pausePrice: (triggerId: string, paused: boolean) =>
      act(`price:${triggerId}`, () => hooksApi.pausePrice(remoraId, triggerId, paused)),
    removePrice: (triggerId: string) =>
      act(`price:${triggerId}`, () => hooksApi.removePrice(remoraId, triggerId)),
    addOut: (url: string, events: HookEvent[]) =>
      act("out:add", () => hooksApi.addOut(remoraId, { url, events })),
    removeOut: (hookId: string) => act(`out:${hookId}`, () => hooksApi.removeOut(remoraId, hookId)),
    testOut: (hookId: string) =>
      act(
        `out:${hookId}`,
        () => hooksApi.testOut(remoraId, hookId),
        (d) => setTested(d.delivery),
      ),
    revealOutSecret: () =>
      act(
        OUT_SECRET,
        () => hooksApi.outSecret(remoraId),
        (d) => reveal(OUT_SECRET, d.secret),
      ),
    rotateOutSecret: () =>
      act(
        OUT_SECRET,
        () => hooksApi.rotateOutSecret(remoraId),
        (d) => reveal(OUT_SECRET, d.secret),
      ),
  };
}
