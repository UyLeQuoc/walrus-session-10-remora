import type { ConversationSummary } from "./use-conversations";

export function filterConversations(
  items: readonly ConversationSummary[],
  query: string,
): ConversationSummary[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...items];
  return items.filter((item) => item.title.toLowerCase().includes(needle));
}
