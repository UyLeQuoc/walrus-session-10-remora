import { CHANNEL_COMMANDS } from "@remora/core/commands";
import type { LucideIcon } from "lucide-react";
import {
  CircleHelp,
  Columns2,
  Download,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Library,
  Link,
  Lock,
  Unplug,
  User,
} from "lucide-react";

export interface SlashItem {
  command: string;
  description: string;
  icon: LucideIcon;
}

const ICONS: Record<(typeof CHANNEL_COMMANDS)[number]["name"], LucideIcon> = {
  memory: Library,
  whoami: User,
  proof: Fingerprint,
  compare: Columns2,
  export: Download,
  link: Link,
  connect: KeyRound,
  disconnect: Unplug,
  privacy: Lock,
  help: CircleHelp,
};

const TOGGLES: SlashItem[] = [
  { command: "/memory on", description: "start remembering again", icon: Eye },
  { command: "/memory off", description: "stop remembering new facts", icon: EyeOff },
];

export const SLASH_ITEMS: SlashItem[] = CHANNEL_COMMANDS.flatMap((command) => {
  const item = {
    command: `/${command.name}`,
    description: command.description,
    icon: ICONS[command.name],
  };
  return command.name === "memory" ? [item, ...TOGGLES] : [item];
});

/** The text after `/` when the draft is choosing a command, otherwise null. */
export function slashDraft(text: string): string | null {
  if (!text.startsWith("/") || text.includes("\n")) return null;
  return text.slice(1);
}

const USAGE: Record<string, Array<{ command: string; description: string }>> = {
  "/memory": [
    { command: "/memory", description: "what I remember about you" },
    { command: "/memory search <question>", description: "search your memory" },
    { command: "/memory on", description: "start remembering again" },
    { command: "/memory off", description: "stop remembering new facts" },
    { command: "/memory forget <blob>", description: "stop me using one memory" },
    { command: "/memory forget all", description: "make every memory unrecallable" },
    { command: "/memory unhide <blob>", description: "use one memory again" },
  ],
  "/link": [
    { command: "/link", description: "a code for another channel" },
    { command: "/link <code>", description: "use a code from another channel" },
  ],
};

/** The root command in the box, such as `/memory` inside `/memory search <question>`. */
export function commandRoot(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const names = CHANNEL_COMMANDS.map((command) => command.name).sort((a, b) => b.length - a.length);
  for (const name of names) {
    const command = `/${name}`;
    if (trimmed === command || trimmed.startsWith(`${command} `)) return command;
  }
  return null;
}

export function commandUsages(root: string): Array<{ command: string; description: string }> {
  const listed = USAGE[root];
  if (listed) return listed;
  const item = SLASH_ITEMS.find((entry) => entry.command === root);
  return item ? [{ command: item.command, description: item.description }] : [];
}

export function filterSlashCommands(query: string): SlashItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return SLASH_ITEMS;
  return SLASH_ITEMS.filter((item) => item.command.slice(1).toLowerCase().startsWith(needle));
}

export type SlashKeyAction =
  | { type: "run"; index: number }
  | { type: "move"; index: number }
  | { type: "dismiss" }
  | { type: "ignore" };

export function slashKeyAction(key: string, index: number, count: number): SlashKeyAction {
  if (count === 0) return { type: "ignore" };
  switch (key) {
    case "Enter":
      return { type: "run", index };
    case "ArrowDown":
      return { type: "move", index: (index + 1) % count };
    case "ArrowUp":
      return { type: "move", index: (index - 1 + count) % count };
    case "Escape":
      return { type: "dismiss" };
    default:
      return { type: "ignore" };
  }
}
