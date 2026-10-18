import {
  Activity,
  Columns2,
  Fingerprint,
  History,
  Import,
  KeyRound,
  Lock,
  type LucideIcon,
  MessageSquare,
  NotebookPen,
  RotateCcw,
  ShieldX,
  UserRound,
  Wallet,
} from "lucide-react";

export interface FlowStep {
  icon: LucideIcon;
  title: string;
  detail: string;
}

export const MEMORY_FLOW: FlowStep[] = [
  { icon: MessageSquare, title: "You say it", detail: "“We moved this project to bun.”" },
  {
    icon: NotebookPen,
    title: "hippo keeps the fact",
    detail: "One typed line. Keys and tokens stripped.",
  },
  { icon: Lock, title: "Sealed on Walrus", detail: "Encrypted, kept about seven months." },
  { icon: RotateCcw, title: "Recalled next time", detail: "Any chat, any channel. Newest wins." },
];

export const SAMPLE_MEMORY = "[correction] [by:@mai] [2026-10-06] We moved this project to bun.";

export interface Contrast {
  title: string;
  lines: Array<{ text: string; yes: boolean }>;
}

export const CHAT_VS_MEMORY: [Contrast, Contrast] = [
  {
    title: "The chat",
    lines: [
      { text: "Encrypted on hippo's server", yes: true },
      { text: "Reload shows it again", yes: true },
      { text: "Written to Walrus", yes: false },
      { text: "Yours to delete", yes: true },
    ],
  },
  {
    title: "A memory",
    lines: [
      { text: "A fact, not the conversation", yes: true },
      { text: "Encrypted on Walrus", yes: true },
      { text: "Recalled in every chat and channel", yes: true },
      { text: "Deletable before it expires", yes: false },
    ],
  },
];

export interface OwnershipStage {
  icon: LucideIcon;
  title: string;
  where: string;
  command?: string;
}

export const OWNERSHIP: OwnershipStage[] = [
  { icon: UserRound, title: "Guest", where: "In hippo's account, under hippo-guest:…" },
  {
    icon: Wallet,
    title: "Yours",
    where: "Your Sui account. hippo holds a key.",
    command: "/connect",
  },
  {
    icon: ShieldX,
    title: "Revoked",
    where: "Key removed on chain. hippo can't read.",
    command: "/disconnect",
  },
];

export interface Proof {
  icon: LucideIcon;
  title: string;
  detail: string;
  where: string;
}

export const PROOFS: Proof[] = [
  {
    icon: Columns2,
    title: "Answer without memory",
    detail: "The same question, memory off, side by side.",
    where: "Chat",
  },
  {
    icon: Fingerprint,
    title: "/proof",
    detail: "The Walrus blobs behind the last answer.",
    where: "Any channel",
  },
  {
    icon: Activity,
    title: "Memory at work",
    detail: "How many answers used your memory.",
    where: "My memory",
  },
  {
    icon: KeyRound,
    title: "Read it with your wallet",
    detail: "Decrypt in the browser. No relayer.",
    where: "My memory, once you own it",
  },
  {
    icon: History,
    title: "How it changed",
    detail: "Each correction beside the fact it replaced.",
    where: "My memory",
  },
  {
    icon: Import,
    title: "Bring it with you",
    detail: "Paste what another assistant knows. Keep what you tick.",
    where: "My memory",
  },
];

export interface CommandGroup {
  title: string;
  commands: Array<[string, string]>;
}

export const COMMAND_GROUPS: CommandGroup[] = [
  {
    title: "Memory",
    commands: [
      ["/memory", "what hippo remembers"],
      ["/memory search", "read it back from Walrus"],
      ["/memory forget", "stop using one, or all"],
      ["/memory off", "stop keeping new facts"],
    ],
  },
  {
    title: "Proof",
    commands: [
      ["/proof", "blobs behind the last answer"],
      ["/compare", "last answer, without memory"],
      ["/export", "everything, as a file"],
    ],
  },
  {
    title: "Ownership",
    commands: [
      ["/connect", "own it in your account"],
      ["/disconnect", "revoke hippo on chain"],
      ["/whoami", "where your memory lives"],
    ],
  },
  {
    title: "Together",
    commands: [
      ["/link", "same memory, another channel"],
      ["/team", "share with a few people"],
      ["/privacy", "what is stored, how long"],
    ],
  },
];

export const CLAUDE_CODE_STEPS = [
  "/plugin marketplace add MystenLabs/MemWal",
  "/plugin install memwal@memwal-plugins",
  "Log in to Walrus Memory with the same wallet",
  'What does hippo know about me? Use memwal_recall with namespace "hippo".',
];
