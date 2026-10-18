import { z } from "zod";

const MAX_SUGGESTIONS = 3;
const MAX_LENGTH = 160;

const suggestionList = z.object({
  suggestions: z.array(z.string()),
});

const FOLLOW_UP_SYSTEM =
  'Suggest the next three things the user might type. Reply with JSON only, shaped {"suggestions":["...","...","..."]}. Each item is one short message in the user\'s language, at most 160 characters, and is something the user would send. Do not give the assistant new facts to store.';

export interface FollowUpLine {
  role: "user" | "assistant";
  text: string;
}

export interface FollowUpRequest {
  system: string;
  prompt: string;
}

export function suggestionPrompt(lines: readonly FollowUpLine[]): string {
  return lines.map((line) => `${line.role === "user" ? "User" : "Hippo"}: ${line.text}`).join("\n");
}

export function followUpRequest(lines: readonly FollowUpLine[]): FollowUpRequest {
  return { system: FOLLOW_UP_SYSTEM, prompt: suggestionPrompt(lines) };
}

export function parseSuggestions(raw: string): string[] {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end < start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return [];
  }
  const body = suggestionList.safeParse(parsed);
  if (!body.success) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of body.data.suggestions) {
    const text = item.trim().replace(/\s+/g, " ");
    if (text.length < 2 || text.length > MAX_LENGTH) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length === MAX_SUGGESTIONS) break;
  }
  return out;
}

export async function suggestFollowUps(
  lines: readonly FollowUpLine[],
  complete: (request: FollowUpRequest) => Promise<string>,
): Promise<string[]> {
  if (lines.length === 0) return [];
  try {
    return parseSuggestions(await complete(followUpRequest(lines)));
  } catch {
    return [];
  }
}
