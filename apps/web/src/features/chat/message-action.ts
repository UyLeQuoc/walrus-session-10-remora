/** A control inside a message (copy a code block, a table): hidden until the message is hovered (ADR-0069). */
export const messageActionClass =
  "opacity-0 [.message-entry:hover_&]:opacity-100 [.message-entry:focus-within_&]:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100";
