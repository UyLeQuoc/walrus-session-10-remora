/**
 * Agent text as people read it (ADR-0103): without the `<untrusted source="…">` wrappers a model
 * sometimes copies from the tool output it quoted, and without runs of blank lines.
 */
export const readable = (text: string) =>
  text
    .replace(/<\/?untrusted[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
