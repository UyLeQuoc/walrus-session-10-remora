/**
 * Does an identity carried in a header work the same as one in a cookie?
 *
 * This is what lets the UI live anywhere, Walrus Sites included, where nothing
 * can proxy the API onto the page's own origin and a `SameSite=Lax` cookie
 * would never be sent. Sending no cookie at all is the point of the test.
 */
const API = process.env.HIPPO_API_URL ?? "https://hippo-server-production.up.railway.app";
const guest = crypto.randomUUID();

async function say(text: string, sessionStart = false): Promise<string> {
  const res = await fetch(`${API}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hippo-guest": guest },
    body: JSON.stringify({
      messages: [{ id: String(Date.now()), role: "user", parts: [{ type: "text", text }] }],
      sessionStart,
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("application/json"))
    return ((await res.json()) as { text?: string }).text ?? "";

  let out = "";
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const part = JSON.parse(line.slice(6)) as { type?: string; delta?: string };
        if (part.type === "text-delta" && part.delta) out += part.delta;
      } catch {
        // partial frame
      }
    }
  }
  return out;
}

console.log(`api: ${API}`);
console.log(`guest id in a header, no cookie anywhere: ${guest}`);

console.log("\n1. teach");
console.log(`   ${(await say("Remember: my favourite number is 4173.")).slice(0, 120)}`);

console.log("\n2. the same header identity sees itself");
const who = await fetch(`${API}/api/me`, { headers: { "x-hippo-guest": guest } });
console.log(`   ${JSON.stringify(await who.json())}`);

console.log("\n3. a different header identity must not");
const other = await fetch(`${API}/api/me`, { headers: { "x-hippo-guest": crypto.randomUUID() } });
const otherBody = (await other.json()) as { namespace?: string };
console.log(`   namespace differs: ${otherBody.namespace !== `hippo-guest:${guest}`}`);

console.log("\n4. a malformed header is ignored, not trusted");
const bad = await fetch(`${API}/api/me`, { headers: { "x-hippo-guest": "not-a-uuid" } });
console.log(`   ${JSON.stringify(await bad.json())}`);
process.exit(0);

export {};
