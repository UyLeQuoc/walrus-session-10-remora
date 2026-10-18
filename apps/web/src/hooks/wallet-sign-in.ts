import { apiFetch, rememberSession } from "@/lib/api";

export type SignInStep = { ok: true } | { ok: false; error: string };

export async function requestSignInChallenge(): Promise<{ nonce: string; message: string }> {
  const challenge = await apiFetch("/api/auth/challenge", { method: "POST" });
  if (!challenge.ok) throw new Error("Could not start sign-in.");
  const body = (await challenge.json()) as { nonce?: unknown; message?: unknown };
  if (typeof body.nonce !== "string" || typeof body.message !== "string") {
    throw new Error("Could not start sign-in.");
  }
  return { nonce: body.nonce, message: body.message };
}

export async function finishSignIn(nonce: string, signature: string): Promise<SignInStep> {
  const verified = await apiFetch("/api/auth/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nonce, signature }),
  });
  if (!verified.ok) {
    const body = (await verified.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: body?.error ?? "Sign-in failed." };
  }
  const body = (await verified.json()) as { sessionId?: string };
  if (body.sessionId) rememberSession(body.sessionId);
  return { ok: true };
}
