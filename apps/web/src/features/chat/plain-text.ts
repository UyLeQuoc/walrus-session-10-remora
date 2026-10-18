import { type MarkedToken, marked, type Token, type Tokens } from "marked";

const MARKED_TYPES = new Set<string>([
  "blockquote",
  "br",
  "checkbox",
  "code",
  "codespan",
  "def",
  "del",
  "em",
  "escape",
  "heading",
  "hr",
  "html",
  "image",
  "link",
  "list",
  "list_item",
  "paragraph",
  "space",
  "strong",
  "table",
  "text",
]);

export function plainText(markdown: string): string {
  try {
    const tokens = marked.lexer(markdown, { gfm: true, breaks: true });
    return flatten(tokens)
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return markdown.trim();
  }
}

function flatten(tokens: Token[]): string {
  return tokens.map(render).join("");
}

function render(token: Token): string {
  // marked's Generic token types `type` as string, so a switch never narrows it.
  if (!MARKED_TYPES.has(token.type)) return fallback(token);
  return renderMarked(token as MarkedToken);
}

function renderMarked(token: MarkedToken): string {
  switch (token.type) {
    case "paragraph":
    case "heading":
    case "blockquote":
      return `${flatten(token.tokens)}\n`;
    case "text":
      return token.tokens ? flatten(token.tokens) : token.text;
    case "escape":
    case "codespan":
      return token.text;
    case "strong":
    case "em":
    case "del":
      return flatten(token.tokens);
    case "code":
      return `${token.text.replace(/\n$/, "")}\n`;
    case "link":
      return flatten(token.tokens) || token.href;
    case "image":
      return flatten(token.tokens) || token.text;
    case "br":
      return "\n";
    case "list":
      return token.items.map((item) => render(item)).join("");
    case "list_item":
      return `${flatten(token.tokens).trim()}\n`;
    case "table":
      return `${tableText(token)}\n`;
    case "html":
      return token.text.replace(/<[^>]*>/g, "");
    case "space":
      return "\n";
    case "checkbox":
    case "hr":
    case "def":
      return "";
    default: {
      const leftover: never = token;
      return leftover;
    }
  }
}

function tableText(token: Tokens.Table): string {
  const line = (cells: Tokens.TableCell[]) =>
    cells.map((cell) => flatten(cell.tokens).replace(/\s+/g, " ").trim()).join("\t");
  return [line(token.header), ...token.rows.map((row) => line(row))].join("\n");
}

function fallback(token: Token): string {
  if ("tokens" in token && token.tokens) return flatten(token.tokens);
  if ("text" in token && typeof token.text === "string") return token.text;
  return "";
}
