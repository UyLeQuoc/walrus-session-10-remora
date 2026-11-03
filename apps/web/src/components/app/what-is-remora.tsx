/**
 * ADR-0095: what Remora is, in three lines and two kinds, wherever a newcomer lands first (signed-out
 * Home, the first Home with no remora, the guide). Plain words only (ADR-0094). ADR-0098: each kind
 * shows its face, and a row says what the faces mean.
 */
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { RemoraAvatar, type RemoraMood } from "@/components/app/remora-avatar";

export const WHAT_IS_REMORA =
  "A remora is an AI agent that works for you around the clock. It has its own key, a spending limit Sui enforces, memory you can read on Walrus, and a receipt for everything it does. It never holds your wallet.";

export const KINDS = [
  {
    mood: "idle",
    name: "Scout",
    detail:
      "Answers your questions. It buys the data it needs from paid services, like a 0.01 USDC risk report on a Sui package, and learns which sources are worth it.",
  },
  {
    mood: "listening",
    name: "Sentinel",
    detail:
      "Watches your wallets and tells you only what matters. Teach it in plain words, like “ignore incoming SUI under 0.002”. It never pays.",
  },
] as const satisfies ReadonlyArray<{ mood: RemoraMood; name: string; detail: string }>;

/** What a remora's face says, in the order you meet them. */
export const FACES: ReadonlyArray<{ mood: RemoraMood; label: string }> = [
  { mood: "listening", label: "watching" },
  { mood: "thinking", label: "thinking" },
  { mood: "success", label: "paid" },
  { mood: "alert", label: "needs you" },
  { mood: "error", label: "blocked a payment" },
  { mood: "asleep", label: "paused" },
];

export function WhatIsRemora({ guideLink = true }: { guideLink?: boolean }) {
  return (
    <section
      aria-labelledby="what-is-remora"
      className="flex flex-col gap-3 rounded-ob-card border border-ob-border-grouped bg-ob-grouped p-4"
      data-testid="what-is-remora"
    >
      <div className="flex flex-col gap-1">
        <h2 id="what-is-remora" className="text-sm font-semibold text-ob-text">
          What's a remora?
        </h2>
        <p className="text-md text-ob-secondary">{WHAT_IS_REMORA}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {KINDS.map((k) => (
          <div key={k.name} className="flex items-start gap-3">
            <RemoraAvatar id={k.name} mood={k.mood} size={32} />
            <p className="text-md text-ob-muted">
              <b className="font-medium text-ob-text">{k.name}</b> {k.detail}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-md text-ob-muted">Its face tells you what it's doing:</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="What a remora's face means">
          {FACES.map((f) => (
            <li key={f.mood} className="flex items-center gap-1.5 text-md text-ob-secondary">
              <RemoraAvatar id="Scout" mood={f.mood} size={28} />
              {f.label}
            </li>
          ))}
        </ul>
      </div>
      {guideLink ? (
        <Link className="link inline-flex w-fit items-center gap-1 text-md" to="/guide">
          How to use it, page by page <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}
