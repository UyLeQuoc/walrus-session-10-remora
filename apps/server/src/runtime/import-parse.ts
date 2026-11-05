/**
 * A4 (ADR-0146): what an owner already wrote down for another assistant, read as candidate lines.
 * Pure: no I/O. The formats:
 * - Claude Code `CLAUDE.md`, `MEMORY.md` and memory files, Codex `AGENTS.md`, plain Markdown;
 * - Cursor rules (`.mdc`), with their frontmatter stripped (its `description` kept as a line);
 * - a ChatGPT export (`conversations.json`): each conversation's thread, user and assistant text,
 *   dated by its `create_time`.
 *
 * Everything read here is data, never instructions (ADR-0110): a line can't become a rule, a contact
 * or a payee, it's written with its source, and the prompt reads it inside `<untrusted>` tags.
 */
import { createHash } from "node:crypto";
import { redactCredentials } from "@remora/memory";
import { z } from "zod";

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
/** The relayer's `analyze` takes one chunk at a time; ours are at most this many bytes. */
export const CHUNK_BYTES = 64 * 1024;
export const MAX_CANDIDATES = 300;
export const MAX_TICKED = 100;
const MAX_LINE = 400;

export type ImportKind = "claude" | "agents" | "cursor" | "chatgpt" | "markdown";

export interface Segment {
  text: string;
  /** ISO time the text was written, when the file says. */
  at?: string;
}

export interface Chunk {
  text: string;
  at?: string;
}

export interface Candidate {
  i: number;
  text: string;
  /** The day it was written (YYYY-MM-DD), when the file says. */
  at: string | null;
  /** `analyze`: the relayer extracted it; `lines`: split from the file as written. */
  via: "analyze" | "lines";
  /** Why it looks like an instruction: unticked by default, and still only stored as text. */
  flag: string | null;
}

export class ImportError extends Error {}

const bytes = (s: string) => new TextEncoder().encode(s).length;

/** `../notes/CLAUDE.md` → `CLAUDE.md`; only letters, digits, `._-`, at most 60 characters. */
export function importFileName(name: string | undefined): string {
  const base = (name ?? "").split(/[\\/]/).pop() ?? "";
  const clean = base
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+\./g, ".")
    .replace(/^[-.]+|-+$/g, "")
    .slice(0, 60);
  return clean || "pasted";
}

/** The first 8 hex characters of the file's sha256: which file a line came from. */
export const fileSha8 = (raw: string) =>
  createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 8);

const FRONTMATTER = /^\s*---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export function kindOf(fileName: string, raw: string): ImportKind {
  const lower = fileName.toLowerCase();
  const markdown = /\.(md|mdc|markdown|txt)$/.test(lower);
  if (lower.endsWith(".json") || (!markdown && /^\s*[[{]/.test(raw))) return "chatgpt";
  if (lower.endsWith(".mdc")) return "cursor";
  if (lower === "agents.md") return "agents";
  // A Claude Code memory file says its `type:` in its frontmatter.
  const front = FRONTMATTER.exec(raw)?.[1] ?? "";
  if (lower === "claude.md" || lower === "memory.md" || /^type:\s*\w+/m.test(front))
    return "claude";
  return "markdown";
}

/** Frontmatter out; its `description:` value stays as the first line. */
export function stripFrontmatter(raw: string): string {
  const m = FRONTMATTER.exec(raw);
  if (!m) return raw;
  const description = /^description:\s*["']?(.+?)["']?\s*$/m.exec(m[1] ?? "")?.[1];
  const body = raw.slice(m[0].length);
  return description ? `${description}\n\n${body}` : body;
}

const Node = z
  .object({
    message: z
      .object({
        author: z.object({ role: z.string().optional() }).loose().optional(),
        content: z
          .object({ content_type: z.string().optional(), parts: z.array(z.unknown()).optional() })
          .loose()
          .optional(),
        create_time: z.number().nullable().optional(),
      })
      .loose()
      .nullable()
      .optional(),
    parent: z.string().nullable().optional(),
  })
  .loose();
const Conversation = z
  .object({
    title: z.string().nullable().optional(),
    create_time: z.number().nullable().optional(),
    current_node: z.string().nullable().optional(),
    mapping: z.record(z.string(), Node),
  })
  .loose();
type Node = z.infer<typeof Node>;

const isoOf = (seconds: number | null | undefined) =>
  typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : undefined;

/** The thread that was shown: from `current_node` up its parents, or every message by time. */
function thread(mapping: Record<string, Node>, current?: string | null): Node[] {
  const out: Node[] = [];
  const seen = new Set<string>();
  let id = current ?? undefined;
  while (id && mapping[id] && !seen.has(id)) {
    seen.add(id);
    const n = mapping[id] as Node;
    out.push(n);
    id = n.parent ?? undefined;
  }
  if (out.length) return out.reverse();
  return Object.values(mapping)
    .filter((n) => n.message)
    .sort((a, b) => (a.message?.create_time ?? 0) - (b.message?.create_time ?? 0));
}

const PER_MESSAGE = { user: 4_000, assistant: 2_000 } as const;

/** ChatGPT's `conversations.json`: one segment per conversation, dated. */
export function chatgptSegments(raw: string): Segment[] {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ImportError("That JSON file doesn't parse. Upload ChatGPT's conversations.json.");
  }
  const list = z
    .array(z.unknown())
    .safeParse(Array.isArray(json) ? json : (json as { conversations?: unknown })?.conversations);
  if (!list.success)
    throw new ImportError("That isn't a ChatGPT export (conversations.json is a list).");
  const out: Segment[] = [];
  for (const item of list.data) {
    const c = Conversation.safeParse(item);
    if (!c.success) continue;
    const lines: string[] = [];
    let first: number | undefined;
    for (const n of thread(c.data.mapping, c.data.current_node)) {
      const role = n.message?.author?.role;
      if (role !== "user" && role !== "assistant") continue;
      const text = (n.message?.content?.parts ?? [])
        .filter((p): p is string => typeof p === "string")
        .join("\n")
        .trim();
      if (!text) continue;
      first ??= n.message?.create_time ?? undefined;
      lines.push(`${role}: ${text.slice(0, PER_MESSAGE[role])}`);
    }
    if (!lines.length) continue;
    const at = isoOf(c.data.create_time) ?? isoOf(first);
    const title = c.data.title?.trim();
    out.push({
      text: [title ? `Conversation: ${title}` : "", ...lines].filter(Boolean).join("\n"),
      ...(at ? { at } : {}),
    });
  }
  if (!out.length) throw new ImportError("No conversations with text in that export.");
  return out;
}

export function parseImport(
  fileName: string,
  raw: string,
): { kind: ImportKind; segments: Segment[] } {
  if (!raw.trim()) throw new ImportError("The file is empty.");
  if (bytes(raw) > IMPORT_MAX_BYTES) throw new ImportError("Import at most 5 MB at a time.");
  const kind = kindOf(fileName, raw);
  if (kind === "chatgpt") return { kind, segments: chatgptSegments(raw) };
  return { kind, segments: [{ text: stripFrontmatter(raw) }] };
}

/**
 * I5 first: credentials (the scrubber every memory write runs), then the people in it: email
 * addresses, phone numbers and `@handles`. A file import (`@AGENTS.md`) or a package scope
 * (`@remora/schema`) isn't a handle.
 */
export function scrubImport(input: string): { text: string; removed: string[] } {
  const { text: secretFree, removed } = redactCredentials(input);
  let text = secretFree;
  const people: [string, RegExp, string][] = [
    ["email", /[\w.+-]+@[\w-]+\.[\w.-]+/g, "[REDACTED:email]"],
    [
      "phone",
      /(?<![\w+])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|\d{2,4}[\s.-])\d{3,4}[\s.-]\d{3,4}(?![\w])/g,
      "[REDACTED:phone]",
    ],
    ["handle", /(^|[\s(])@[A-Za-z0-9_]{2,30}(?![\w./@-])/g, "$1[REDACTED:handle]"],
  ];
  for (const [kind, re, to] of people) {
    const next = text.replace(re, to);
    if (next !== text) removed.push(kind);
    text = next;
  }
  return { text, removed };
}

/**
 * At most `CHUNK_BYTES` each, and one date per chunk (`analyze` takes one `occurredAt`): segments of
 * the same day are packed together, a longer one is split on lines.
 */
export function chunkSegments(segments: Segment[], max = CHUNK_BYTES): Chunk[] {
  const out: Chunk[] = [];
  let cur: Chunk | null = null;
  const day = (at?: string) => at?.slice(0, 10) ?? "";
  const push = (text: string, at?: string) => {
    if (cur && day(cur.at) === day(at) && bytes(cur.text) + bytes(text) + 2 <= max) {
      cur.text = `${cur.text}\n\n${text}`;
      return;
    }
    cur = { text, ...(at ? { at } : {}) };
    out.push(cur);
  };
  // A character is at most 4 bytes in UTF-8, so this many characters always fit.
  const hard = Math.floor(max / 4);
  for (const s of segments) {
    if (bytes(s.text) <= max) {
      push(s.text, s.at);
      continue;
    }
    let piece = "";
    for (const line of s.text.split("\n")) {
      const parts =
        line.length > hard ? (line.match(new RegExp(`[\\s\\S]{1,${hard}}`, "g")) ?? []) : [line];
      for (const p of parts) {
        if (piece && bytes(piece) + bytes(p) + 1 > max) {
          push(piece, s.at);
          cur = null;
          piece = "";
        }
        piece = piece ? `${piece}\n${p}` : p;
      }
    }
    if (piece) push(piece, s.at);
    cur = null;
  }
  return out;
}

const FIRST_PERSON = /\b(i|i'm|i've|i'd|my|me|we|our|us)\b/i;

/** Without `analyze`: the lines as written, list markers and Markdown links stripped. */
export function splitLines(chunk: Chunk, kind: ImportKind): string[] {
  const out: string[] = [];
  let fenced = false;
  for (const rawLine of chunk.text.split("\n")) {
    if (/^\s*(```|~~~)/.test(rawLine)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    let line = rawLine.trim();
    if (kind === "chatgpt") {
      if (!/^user:\s/.test(line)) continue;
      line = line.replace(/^user:\s*/, "");
      if (!FIRST_PERSON.test(line)) continue;
    }
    if (/^(#|\||<!--|-{3,}|={3,}|@[\w./-]+$)/.test(line)) continue;
    line = line
      .replace(/^(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, "")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/(\*\*|__)(.+?)\1/g, "$2")
      .replace(/\s+/g, " ")
      .trim();
    if (line.length < 12 || line.split(" ").length < 3) continue;
    out.push(line);
  }
  return out;
}

const INSTRUCTION: [RegExp, string][] = [
  [
    /\b(ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|your|system|the)\b[^.\n]{0,20}\b(instructions?|rules?|prompts?|guidelines?|limits?)\b/i,
    "it tells the remora to ignore its rules",
  ],
  [
    /\b(pay|send|transfer|withdraw|drain|forward)\b[^\n]{0,60}\b0x[0-9a-fA-F]{4,}/i,
    "it asks to pay an address",
  ],
  [/\b(private key|seed phrase|mnemonic|recovery phrase)s?\b/i, "it talks about keys"],
  [/\byou are (now|no longer)\b|\bsystem prompt\b/i, "it tries to change who the remora is"],
  [/<\/?\s*(untrusted|system|assistant|tool)\b/i, "it tries to break out of the data tags"],
];

/** Why a line reads like an instruction, or null. It's still stored only as text. */
export function instructionReason(text: string): string | null {
  for (const [re, why] of INSTRUCTION) if (re.test(text)) return why;
  return null;
}

const clip = (s: string) => {
  if (s.length <= MAX_LINE) return s;
  const cut = s.slice(0, MAX_LINE - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), MAX_LINE - 40))}…`;
};

/** Scrubbed again, one line each, no repeats, at most `MAX_CANDIDATES`. */
export function buildCandidates(
  found: { text: string; at?: string; via: Candidate["via"] }[],
  max = MAX_CANDIDATES,
): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const f of found) {
    const text = clip(scrubImport(f.text).text.replace(/\s+/g, " ").trim());
    const key = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
    if (text.length < 3 || !key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      i: out.length,
      text,
      at: f.at ? f.at.slice(0, 10) : null,
      via: f.via,
      flag: instructionReason(text),
    });
    if (out.length >= max) break;
  }
  return out;
}

export const importSource = (fileName: string, sha8: string) =>
  `SOURCE: import ${importFileName(fileName)} ${sha8}`;

/** Our own record shapes (a track record, a rule, a contact) can't be imported as themselves. */
const RESERVED = /^(?:SOURCE|RULE|CONTACT|REVIEW|EVENT|TIDY)\b|^\[(?:rule|correction)\]/i;

/** The text written to Walrus: the line as data, ending with where it came from. */
export function importLine(text: string, source: string): string {
  const body = text.trim();
  return `${RESERVED.test(body) ? `note: ${body}` : body} · ${source}`;
}

const IMPORTED = /·\s*SOURCE:\s*import\s+([\w.-]+)\s+([0-9a-f]{8})\s*$/;

/** The source an imported memory names, or null when it wasn't imported. */
export function importedFrom(text: string): string | null {
  const m = IMPORTED.exec(text.trim());
  return m ? `import ${m[1]} ${m[2]}` : null;
}

/**
 * How a recalled memory reads in a prompt: an imported one inside `<untrusted>` tags that name its
 * file, so the model treats it as data (brain.ts's `UNTRUSTED_INSTRUCTION`); any other as it is.
 */
export function labelMemory(text: string): string {
  const source = importedFrom(text);
  if (!source) return text;
  const safe = text.replace(/<(\/?\s*untrusted)/gi, "‹$1");
  return `<untrusted source="${source}">${safe}</untrusted>`;
}
