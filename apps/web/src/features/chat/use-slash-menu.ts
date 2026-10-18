import { useState } from "react";
import { filterSlashCommands, type SlashItem, slashDraft, slashKeyAction } from "./slash-menu";

export function useSlashMenu(input: {
  text: string;
  busy: boolean;
  /** A chosen command is filling the box, so the picker stays closed. */
  pinned: boolean;
  apply: (command: string) => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [index, setIndex] = useState(0);
  const [seen, setSeen] = useState(input.text);
  if (seen !== input.text) {
    setSeen(input.text);
    setDismissed(false);
    setIndex(0);
  }
  const draft = input.busy || input.pinned ? null : slashDraft(input.text);
  const items = draft === null ? [] : filterSlashCommands(draft);
  const active = items.length === 0 ? 0 : Math.min(index, items.length - 1);
  const open = draft !== null && !dismissed && items.length > 0;

  const run = (item: SlashItem) => {
    input.apply(item.command);
  };

  const onKeyDown = (key: string): "handled" | "pass" => {
    if (!open) return "pass";
    const action = slashKeyAction(key, active, items.length);
    switch (action.type) {
      case "ignore":
        return "pass";
      case "dismiss":
        setDismissed(true);
        return "handled";
      case "move":
        setIndex(action.index);
        return "handled";
      case "run": {
        const item = items[action.index];
        if (item) run(item);
        return "handled";
      }
      default: {
        const unreachable: never = action;
        return unreachable;
      }
    }
  };

  return {
    open,
    items,
    active,
    dismiss: () => setDismissed(true),
    highlight: setIndex,
    run,
    onKeyDown,
  };
}
