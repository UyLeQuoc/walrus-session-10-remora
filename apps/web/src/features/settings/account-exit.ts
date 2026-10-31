/**
 * H6 / A8: leaving Remora, on the endpoints of U9 (ADR-0076). A server without them still answers 404,
 * so every call here treats a 404 as "not available yet", never as a crash.
 *  - `GET  /api/account/export`          -> `AccountExport`: memories + Wakes, one JSON (owner only).
 *  - `POST /api/account/retire`          -> `AccountRetire`: one prepared transaction (for the wallet to
 *                                           sign) that revokes every non-retired remora's Disc.
 *  - `POST /api/account/retire/confirm`  `{ digest }` -> `{ retired: string[] }`: the server marks them
 *                                           retired once the digest is final (mirrors B8's per-remora
 *                                           `retire` / `retire/confirm`).
 *
 * The shapes live in `packages/schema` (ADR-0076).
 */
import { AccountExport, AccountRetire, AccountRetired } from "@remora/schema";
import { apiFetch, errorMessage } from "@/lib/api";

export { AccountExport, AccountRetire, AccountRetired };

export const ACCOUNT_EXPORT_FIXTURE: AccountExport = {
  v: 1,
  exportedAt: "2026-11-04T09:00:00Z",
  memories: [{ blobId: "blob-1", text: "I prefer short answers." }],
  wakes: [{ id: "9a7e1c44-0f1d-4f9a-8d55-3b2a1c0d9e88", remora: "scout" }],
};

export const ACCOUNT_RETIRE_FIXTURE: AccountRetire = {
  transaction: "AAAA",
  remoraIds: ["0b6f2d4e-8a51-4c3e-9f1a-2d7c5b8e9a10"],
};

/** Thrown when the endpoint is not deployed yet (404/405/501): callers show a quiet notice. */
export class NotAvailableYet extends Error {
  constructor() {
    super("This isn't available yet.");
  }
}

async function send(method: string, path: string, body?: unknown): Promise<unknown> {
  let res: Response;
  try {
    res = await apiFetch(path, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error("Can't reach the server.");
  }
  if ([404, 405, 501].includes(res.status)) throw new NotAvailableYet();
  if (!res.ok) throw new Error(await errorMessage(res, "Something went wrong."));
  return res.json().catch(() => null);
}

const WRONG_SHAPE = "The server answered in a shape this page doesn't know.";

/** The raw JSON text is what gets downloaded; it is parsed only to check the shape and count. */
export async function fetchAccountExport(): Promise<{ text: string; data: AccountExport }> {
  let res: Response;
  try {
    res = await apiFetch("/api/account/export");
  } catch {
    throw new Error("Can't reach the server.");
  }
  if ([404, 405, 501].includes(res.status)) throw new NotAvailableYet();
  if (!res.ok) throw new Error(await errorMessage(res, "The export failed."));
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(WRONG_SHAPE);
  }
  const parsed = AccountExport.safeParse(json);
  if (!parsed.success) throw new Error(WRONG_SHAPE);
  return { text, data: parsed.data };
}

export async function prepareRetireAll(): Promise<AccountRetire> {
  const parsed = AccountRetire.safeParse(await send("POST", "/api/account/retire"));
  if (!parsed.success) throw new Error(WRONG_SHAPE);
  return parsed.data;
}

export async function confirmRetireAll(digest: string): Promise<string[]> {
  const parsed = AccountRetired.safeParse(
    await send("POST", "/api/account/retire/confirm", { digest }),
  );
  if (!parsed.success) throw new Error(WRONG_SHAPE);
  return parsed.data.retired;
}

/** N6: a wallet's "User rejected the request" becomes a sentence that says nothing happened. */
export function humanSignError(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  if (/reject|denied|declin|cancel/i.test(message))
    return "You declined the signature in your wallet. Nothing was retired.";
  return message || "That didn't work. Nothing was retired.";
}

export const exportFileName = (now = new Date()) =>
  `remora-export-${now.toISOString().slice(0, 10)}.json`;
