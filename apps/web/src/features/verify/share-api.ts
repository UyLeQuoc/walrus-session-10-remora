/**
 * H5: the share endpoints (Uy's U9, not built yet; shapes agreed in the contract request).
 *  - `POST   /api/wakes/:id/share`        → `{ token, url }`, owner only; idempotent (a Wake already
 *                                            shared answers with its existing token)
 *  - `DELETE /api/wakes/:id/share`        → `{ ok: true }`, owner only; the token stops working
 *  - `GET    /api/public/wakes/:token`    → `PublicWake`, no auth; 404 when revoked or unknown
 * `:id` is the Wake's receipt id (`WhyResponse.wake.id`, `VerifyResult.receiptId`).
 * Failures throw the server's human sentence, so a dialog or toast can show it (N6).
 */
import { z } from "zod";
import { apiFetch, errorMessage } from "@/lib/api";
import { PublicWake, ShareLink } from "./public-wake";

async function send(method: string, path: string): Promise<unknown> {
  let res: Response;
  try {
    res = await apiFetch(path, { method });
  } catch {
    throw new Error("Can't reach the server.");
  }
  if (!res.ok) throw new Error(await errorMessage(res, "Something went wrong."));
  return res.json().catch(() => null);
}

export async function shareWake(wakeId: string): Promise<ShareLink> {
  const parsed = ShareLink.safeParse(
    await send("POST", `/api/wakes/${encodeURIComponent(wakeId)}/share`),
  );
  if (!parsed.success) throw new Error("The server answered in a shape this page doesn't know.");
  return parsed.data;
}

export async function unshareWake(wakeId: string): Promise<void> {
  const parsed = z
    .object({ ok: z.literal(true) })
    .safeParse(await send("DELETE", `/api/wakes/${encodeURIComponent(wakeId)}/share`));
  if (!parsed.success) throw new Error("The server answered in a shape this page doesn't know.");
}

export type PublicWakeResult =
  | { status: "ok"; wake: PublicWake }
  | { status: "gone" }
  | { status: "error"; error: string };

export async function fetchPublicWake(token: string): Promise<PublicWakeResult> {
  let res: Response;
  try {
    res = await apiFetch(`/api/public/wakes/${encodeURIComponent(token)}`);
  } catch {
    return { status: "error", error: "Can't reach the server." };
  }
  if (res.status === 404 || res.status === 410) return { status: "gone" };
  if (!res.ok) return { status: "error", error: await errorMessage(res, "Something went wrong.") };
  const parsed = PublicWake.safeParse(await res.json().catch(() => null));
  return parsed.success
    ? { status: "ok", wake: parsed.data }
    : { status: "error", error: "The server answered in a shape this page doesn't know." };
}

/** The link to show: the server's `url`, or this origin plus `/p/:token` when it sends a path. */
export function shareUrl(link: ShareLink): string {
  return /^https?:\/\//i.test(link.url) ? link.url : `${window.location.origin}${link.url}`;
}
