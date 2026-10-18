import { apiFetch, errorMessage } from "@/lib/api";

export async function setMemoryHidden(
  blobId: string,
  hidden: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await apiFetch("/api/me/memories/visibility", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ blobId, hidden }),
  });
  if (!res.ok) {
    return { ok: false, message: await errorMessage(res, `That failed (${res.status}).`) };
  }
  return { ok: true };
}
