import { isRememberType, type RememberType } from "@/features/chat/remember-types";
import { apiFetch } from "@/lib/api";

export async function postRemember(input: {
  type: RememberType;
  text: string;
  replaces?: string;
}): Promise<
  { ok: true; saved: boolean; indexId?: string; blobId?: string } | { ok: false; message: string }
> {
  const res = await apiFetch("/api/me/memories", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : "Could not store that. Try again.";
    return { ok: false, message };
  }
  if (!body || typeof body !== "object")
    return { ok: false, message: "Could not store that. Try again." };
  const row = body as { saved?: unknown; indexId?: unknown; blobId?: unknown };
  if (typeof row.saved !== "boolean")
    return { ok: false, message: "Could not store that. Try again." };
  return {
    ok: true,
    saved: row.saved,
    ...(typeof row.indexId === "string" ? { indexId: row.indexId } : {}),
    ...(typeof row.blobId === "string" ? { blobId: row.blobId } : {}),
  };
}

export function rememberDraft(text: string, type: RememberType, replaces?: string) {
  const fact = text.trim();
  if (!isRememberType(type) || fact.length < 3) return null;
  return { type, text: fact, ...(replaces ? { replaces } : {}) };
}
