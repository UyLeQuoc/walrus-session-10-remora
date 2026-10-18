import { isValidElement, type ReactNode } from "react";

function nodeText(node: unknown): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement(node)) {
    const props = node.props as { children?: unknown };
    return nodeText(props.children);
  }
  return "";
}

export function fencedBlock(children: ReactNode): { language: string | null; text: string } {
  const node = Array.isArray(children) ? children.find((child) => isValidElement(child)) : children;
  const props = isValidElement(node)
    ? (node.props as { className?: unknown; children?: unknown })
    : null;
  const className = typeof props?.className === "string" ? props.className : "";
  const language = /language-([^\s]+)/.exec(className)?.[1] ?? null;
  const text = nodeText(props ? props.children : children).replace(/\n$/, "");
  return { language, text };
}
