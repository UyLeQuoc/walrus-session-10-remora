/**
 * Something to click, for somebody who has thirty seconds (Q7: Remora examples, not hippo's).
 *
 * The first set is things to teach a remora. After a real answer it switches to the half that
 * matters: reload, then ask. The reload is the point, because a page with no history cannot be
 * answering from memory.
 *
 * A normal reload restores the open chat. The reload button clears that id first, so the empty page
 * still has to answer from Walrus.
 */

import type { LucideIcon } from "lucide-react";
import { Activity, Database, Package, RotateCcw, Search, Shield, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";

export const TEACH: Array<{ icon: LucideIcon; text: string }> = [
  { icon: Shield, text: "Teach Wallet watcher: ignore incoming SUI under 0.01" },
  { icon: Package, text: "Ask Researcher: is package 0x2 safe to depend on?" },
  { icon: Database, text: "Remember that this project settles in USDC on testnet" },
  { icon: Siren, text: "Ping me when a remora pays more than 0.05 USDC at once" },
];

export const ASK: Array<{ icon: LucideIcon; text: string; reload?: boolean }> = [
  { icon: RotateCcw, text: "Reload, then ask what my remoras remember", reload: true },
  { icon: Activity, text: "What did my remoras do today?" },
  { icon: Search, text: "Which sources did the Researcher pay for?" },
  { icon: Shield, text: "/proof" },
];

export function Examples({
  taught,
  onPick,
  onReloadAndAsk,
}: {
  /** True once a remora has answered at least once. */
  taught: boolean;
  onPick: (text: string) => void;
  onReloadAndAsk: (text: string) => void;
}) {
  const rows = taught ? ASK : TEACH;
  return (
    <div className="flex flex-col items-start gap-2">
      {rows.map((row) => (
        <Button
          key={row.text}
          type="button"
          variant="ghost"
          size="sm"
          className="liquid-glass h-auto max-w-full justify-start rounded-full px-3 py-1.5 text-left font-normal whitespace-normal text-muted-foreground hover:bg-white/30 hover:text-foreground dark:hover:bg-white/10"
          onClick={() =>
            "reload" in row && row.reload
              ? onReloadAndAsk("What do my remoras remember?")
              : onPick(row.text)
          }
        >
          <row.icon className="size-4 shrink-0" />
          <span>{row.text}</span>
        </Button>
      ))}
    </div>
  );
}

export { rememberPendingAsk, takePendingAsk } from "@/features/chat/pending-ask";
