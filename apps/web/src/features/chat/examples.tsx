/**
 * Something to click, for somebody who has thirty seconds.
 *
 * The first set is things to teach hippo. After a real answer it switches to
 * the half that matters: reload, then ask. The reload is the point, because a
 * page with no history cannot be answering from context.
 *
 * A normal reload restores the open chat. The reload button clears that id
 * first, so the empty page still has to answer from Walrus. Do not "fix" this
 * by opening the latest chat on `/`.
 *
 * The old labels and the explanation under them made the empty chat read like
 * a manual, so they stay here as comments and are not rendered:
 * "Try one"
 * "Now prove it"
 * Reloading throws the conversation away. Anything hippo still knows came back from Walrus, not from the page.
 */

import type { LucideIcon } from "lucide-react";
import {
  Database,
  Languages,
  Lightbulb,
  Package,
  RotateCcw,
  Search,
  Server,
  Shield,
} from "lucide-react";
export const TEACH: Array<{ icon: LucideIcon; text: string }> = [
  { icon: Package, text: "I only use pnpm, and I want short answers in Vietnamese." },
  { icon: Database, text: "We settled on Drizzle instead of Prisma for this project." },
  { icon: Server, text: "Postgres runs on 5433 here, because 5432 was already taken." },
  { icon: Languages, text: "When I write in Vietnamese, answer in Vietnamese." },
  { icon: Lightbulb, text: "I prefer a short example over a long explanation." },
];

export const ASK: Array<{ icon: LucideIcon; text: string; reload?: boolean }> = [
  { icon: RotateCcw, text: "Reload, then ask what it knows", reload: true },
  { icon: Search, text: "What do you know about me?" },
  { icon: Package, text: "Which package manager should I use here?" },
  { icon: Shield, text: "/proof" },
];

/** Survives the reload the demo depends on. Per-browser, never read by hippo. */
const PENDING_KEY = "hippo.pendingAsk";

export function rememberPendingAsk(text: string): void {
  try {
    sessionStorage.setItem(PENDING_KEY, text);
  } catch {
    // Private browsing. The reload still works, the box is just empty.
  }
}

export function takePendingAsk(): string | null {
  try {
    const v = sessionStorage.getItem(PENDING_KEY);
    if (v) sessionStorage.removeItem(PENDING_KEY);
    return v;
  } catch {
    return null;
  }
}

export function Examples({
  taught,
  onPick,
  onReloadAndAsk,
}: {
  /** True once hippo has answered at least once. */
  taught: boolean;
  onPick: (text: string) => void;
  onReloadAndAsk: (text: string) => void;
}) {
  const rows = taught ? ASK : TEACH;
  return rows.map((row) => (
    <button
      key={row.text}
      type="button"
      onClick={() =>
        "reload" in row && row.reload
          ? onReloadAndAsk("What do you know about me?")
          : onPick(row.text)
      }
      className="flex items-center gap-2 text-left text-sm text-muted-foreground hover:text-primary"
    >
      <row.icon className="size-4 shrink-0" />
      <span>{row.text}</span>
    </button>
  ));
}
