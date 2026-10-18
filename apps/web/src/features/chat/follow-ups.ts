export function followUpList(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const suggestions = (body as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(suggestions)) return [];
  return suggestions.filter(
    (item): item is string => typeof item === "string" && item.trim() !== "",
  );
}
