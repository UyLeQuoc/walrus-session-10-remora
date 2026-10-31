/**
 * ADR-0095: what Remora is, in three lines and two kinds, wherever a newcomer lands first (signed-out
 * Home, the first Home with no remora, the guide). Plain words only (ADR-0094).
 */
import { ArrowRight, Radar, Search } from "lucide-react";
import { Link } from "react-router";

export const WHAT_IS_REMORA =
  "A remora is an AI agent that works for you around the clock. It has its own key, a spending limit Sui enforces, memory you can read on Walrus, and a receipt for everything it does. It never holds your wallet.";

export const KINDS = [
  {
    icon: Search,
    name: "Scout",
    detail:
      "Answers your questions. It buys the data it needs from paid services, like a 0.01 USDC risk report on a Sui package, and learns which sources are worth it.",
  },
  {
    icon: Radar,
    name: "Sentinel",
    detail:
      "Watches your wallets and tells you only what matters. Teach it in plain words, like “ignore incoming SUI under 0.002”. It never pays.",
  },
] as const;

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
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ob-accent-soft text-ob-accent-text">
              <k.icon className="size-4" aria-hidden />
            </span>
            <p className="text-md text-ob-muted">
              <b className="font-medium text-ob-text">{k.name}</b> {k.detail}
            </p>
          </div>
        ))}
      </div>
      {guideLink ? (
        <Link className="link inline-flex w-fit items-center gap-1 text-md" to="/guide">
          How to use it, page by page <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}
