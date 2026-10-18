export function selectedFact(root: HTMLElement | null): string | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !root) return null;
  const text = selection.toString().trim().replace(/\s+/g, " ");
  if (text.length < 3 || text.length > 1000) return null;
  const node = selection.anchorNode;
  if (!node || !root.contains(node)) return null;
  return text;
}
