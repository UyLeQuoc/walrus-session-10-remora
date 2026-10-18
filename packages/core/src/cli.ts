/**
 * `bun run hippo` — hippo in the terminal, and a real channel like any other.
 *
 * It talks to the running server rather than the memory layer directly, so the
 * CLI is the same person as the web chat once they are linked, and every slash
 * command behaves identically. The session cookie is kept in ~/.hippo so the
 * identity survives restarts.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline/promises";

const API_URL = process.env.HIPPO_API_URL ?? "http://localhost:8787";
const DIR = join(homedir(), ".hippo");
const FILE = join(DIR, "session.json");

function loadCookie(): string | null {
  try {
    return (JSON.parse(readFileSync(FILE, "utf8")) as { cookie?: string }).cookie ?? null;
  } catch {
    return null;
  }
}

function saveCookie(cookie: string): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ cookie }, null, 2));
}

interface UIPart {
  type: string;
  text?: string;
  delta?: string;
  input?: { type?: string; text?: string };
}

let cookie = loadCookie();

async function send(text: string, clientMessageId: string) {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hippo-channel": "cli",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ text, clientMessageId }),
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    cookie = setCookie.split(";")[0] ?? cookie;
    if (cookie) saveCookie(cookie);
  }
  if (!res.ok) throw new Error(`server said ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const type = res.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await res.json()) as {
      text?: string;
      files?: Array<{ name: string; content: string }>;
    };
    return { text: body.text ?? "", streamed: false, files: body.files ?? [] };
  }

  // Server-sent UI message stream.
  const reader = res.body?.getReader();
  if (!reader) return { text: "", streamed: false, files: [] };
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";
  let printedPrefix = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === "[DONE]") continue;
      let part: UIPart;
      try {
        part = JSON.parse(payload) as UIPart;
      } catch {
        continue;
      }
      if (part.type === "text-delta" && part.delta) {
        if (!printedPrefix) {
          process.stdout.write("hippo › ");
          printedPrefix = true;
        }
        process.stdout.write(part.delta);
        out += part.delta;
      } else if (part.type === "tool-input-available" && part.input?.text) {
        process.stdout.write(
          `\n  ⟶ remembering [${part.input.type ?? "?"}] ${part.input.text.slice(0, 70)}\n`,
        );
        printedPrefix = false;
      }
    }
  }
  if (printedPrefix) process.stdout.write("\n");
  return { text: out, streamed: true, files: [] };
}

async function main() {
  const health = await fetch(`${API_URL}/api/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`No hippo server at ${API_URL}. Start one with: bun run dev`);
    process.exit(1);
  }
  const info = (await health.json()) as { model?: string };
  console.log(`hippo cli · ${API_URL} · ${info.model ?? "?"}`);
  console.log(
    "/help for commands, /link to share this memory with another channel, /quit to exit\n",
  );

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  // Ctrl+D closes the input, and a question pending on a closed interface never
  // settles, so Node exited with status 13 and the package manager printed a failure block.
  rl.on("close", () => process.exit(0));
  for (;;) {
    const line = (await rl.question("you › ")).trim();
    if (!line) continue;
    if (line === "/quit" || line === "/exit") break;
    try {
      const { text, streamed, files } = await send(line, crypto.randomUUID());
      if (!streamed) console.log(`hippo › ${text}\n`);
      else console.log();
      // `/export` hands back files; the terminal is where they are kept. The
      // name comes from our own server, but it is still stripped to a basename.
      for (const f of files) {
        const path = join(process.cwd(), basename(f.name));
        writeFileSync(path, f.content);
        console.log(`  saved ${path}\n`);
      }
    } catch (err) {
      console.error(`  ${err instanceof Error ? err.message : err}\n`);
    }
  }
  rl.close();
}

await main();
