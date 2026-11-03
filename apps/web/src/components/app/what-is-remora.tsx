/**
 * ADR-0095: what Remora is, wherever a newcomer lands first (signed-out Home, the first Home with no
 * remora, the guide). ADR-0103: one line and a picture of where the money goes, then the two kinds
 * as tiles; the longer sentence lives behind the `?`. ADR-0098: the faces and what they mean.
 */
import { ArrowRight, Bot, ReceiptText, Shield, Store, Wallet } from "lucide-react";
import { Link } from "react-router";
import { RemoraAvatar, type RemoraMood } from "@/components/app/remora-avatar";
import { Flow, Hint } from "@/components/visual";

export const WHAT_IS_REMORA =
  "A remora is an AI agent that works for you around the clock. It has its own key, a spending limit Sui enforces, memory you can read on Walrus, and a receipt for everything it does. It never holds your wallet.";

export const KINDS = [
  {
    mood: "idle",
    name: "Researcher",
    tagline: "Answers questions, buys the data it needs",
    detail:
      "Answers your questions. It buys the data it needs from paid services, like a 0.01 USDC risk report on a Sui package, and learns which sources are worth it.",
  },
  {
    mood: "listening",
    name: "Wallet watcher",
    tagline: "Watches your wallets, pings what matters",
    detail:
      "Watches your wallets and tells you only what matters. Teach it in plain words, like “ignore incoming SUI under 0.002”. It never pays.",
  },
] as const satisfies ReadonlyArray<{
  mood: RemoraMood;
  name: string;
  tagline: string;
  detail: string;
}>;

/** What a remora's face says, in the order you meet them. */
export const FACES: ReadonlyArray<{ mood: RemoraMood; label: string }> = [
  { mood: "listening", label: "watching" },
  { mood: "thinking", label: "thinking" },
  { mood: "success", label: "paid" },
  { mood: "alert", label: "needs you" },
  { mood: "error", label: "blocked a payment" },
  { mood: "asleep", label: "paused" },
];

/** Where the money goes, as one picture: the same flow on Home, the guide and Funds. */
export function MoneyFlow({ className }: { className?: string }) {
  return (
    <Flow
      className={className}
      label="Where the money goes"
      nodes={[
        { id: "you", label: "Your wallet", icon: <Wallet />, sub: "USDC stays yours" },
        {
          id: "limit",
          label: "Spending limit",
          icon: <Shield />,
          sub: "Sui enforces it",
          tone: "accent",
        },
        { id: "remora", label: "Remora", icon: <Bot />, sub: "its own key" },
        { id: "svc", label: "Paid service", icon: <Store />, sub: "e.g. 0.01 USDC" },
        {
          id: "receipt",
          label: "Receipt",
          icon: <ReceiptText />,
          sub: "anyone can check",
          tone: "success",
        },
      ]}
      active={2}
    />
  );
}

export function WhatIsRemora({ guideLink = true }: { guideLink?: boolean }) {
  return (
    <section
      aria-labelledby="what-is-remora"
      className="flex flex-col gap-4 rounded-ob-card border border-ob-border-grouped bg-ob-grouped p-4"
      data-testid="what-is-remora"
    >
      <div className="flex items-center gap-1.5">
        <h2 id="what-is-remora" className="text-sm font-semibold text-ob-text">
          What's a remora?
        </h2>
        <Hint label="More about remoras">{WHAT_IS_REMORA}</Hint>
      </div>
      <p className="-mt-2 text-md text-ob-secondary">An AI agent with a budget it can't break.</p>
      <MoneyFlow />
      <div className="grid gap-3 md:grid-cols-2">
        {KINDS.map((k) => (
          <div
            key={k.name}
            className="flex items-center gap-3 rounded-lg border border-ob-border bg-ob-raised p-3"
          >
            <RemoraAvatar id={k.name} mood={k.mood} size={36} />
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1 text-sm font-medium text-ob-text">
                {k.name}
                <Hint label={`About the ${k.name}`}>{k.detail}</Hint>
              </span>
              <span className="text-xs text-ob-muted">{k.tagline}</span>
            </span>
          </div>
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="What a remora's face means">
        {FACES.map((f) => (
          <li key={f.mood} className="flex items-center gap-1.5 text-xs text-ob-muted">
            <RemoraAvatar id="Researcher" mood={f.mood} size={24} />
            {f.label}
          </li>
        ))}
      </ul>
      {guideLink ? (
        <Link className="link inline-flex w-fit items-center gap-1 text-md" to="/guide">
          How it works <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}
