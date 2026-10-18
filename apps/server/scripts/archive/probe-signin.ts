/**
 * Exercise the wallet sign-in flow end to end with a throwaway keypair.
 *
 * Signing a personal message needs no chain access and costs nothing, so the
 * whole flow is testable here: challenge, sign, verify, session, and the two
 * rejections that matter. Needs a running server.
 */
import { signInMessage, signWithThrowawayWallet } from "@remora/memory";

const API = process.env.HIPPO_API_URL ?? "http://localhost:8787";

async function challenge(): Promise<{ nonce: string; message: string }> {
  const res = await fetch(`${API}/api/auth/challenge`, { method: "POST" });
  if (!res.ok) throw new Error(`challenge failed: ${res.status}`);
  return (await res.json()) as { nonce: string; message: string };
}

async function verify(nonce: string, signature: string) {
  const res = await fetch(`${API}/api/auth/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nonce, signature }),
  });
  return { status: res.status, body: await res.json(), cookie: res.headers.get("set-cookie") };
}

const first = await challenge();
console.log(
  "challenge issued, message matches our own builder:",
  first.message === signInMessage(first.nonce),
);

const { address, signature } = await signWithThrowawayWallet(first.message);
console.log("throwaway wallet:", address);

console.log("\n1. a valid signature opens a session");
const good = await verify(first.nonce, signature);
console.log(`   ${good.status} ${JSON.stringify(good.body)}`);
const session = good.cookie?.split(";")[0] ?? "";
console.log(`   session cookie set: ${session.startsWith("hippo_session=")}`);

console.log("\n2. the same nonce cannot be used twice");
const replay = await verify(first.nonce, signature);
console.log(`   ${replay.status} ${JSON.stringify(replay.body)}`);

console.log("\n3. a signature over a different challenge is refused");
const second = await challenge();
const wrong = await verify(second.nonce, signature);
console.log(`   ${wrong.status} ${JSON.stringify(wrong.body)}`);

console.log("\n4. the session identifies the wallet's person on /api/me");
const me = await fetch(`${API}/api/me`, { headers: { cookie: session } });
console.log(`   ${JSON.stringify(await me.json())}`);

console.log("\n5. signing out closes it");
await fetch(`${API}/api/auth/signout`, { method: "POST", headers: { cookie: session } });
const after = await fetch(`${API}/api/me`, { headers: { cookie: session } });
console.log(`   ${JSON.stringify(await after.json())}`);
process.exit(0);
