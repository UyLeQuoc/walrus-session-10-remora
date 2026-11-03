/**
 * `/guide` (N14, Q4, ADR-0095): what Remora is, the two kinds of remora, five steps to start, and what
 * every page is for; then how it works in four blocks (an agent, memory, a budget, a receipt), each
 * with a picture, a sentence and a link to the page that does it. The Claude Code recipe stays.
 */

import {
  Activity,
  ArrowRight,
  Brain,
  Fish,
  Gauge,
  KeyRound,
  OctagonPause,
  Store,
  Wallet,
  Zap,
} from "lucide-react";
import { Link } from "react-router";
import { RAIL_FOOTER, RAIL_PAGES } from "@/app/app-rail";
import { Page, PageHeader } from "@/components/app/page";
import { WhatIsRemora } from "@/components/app/what-is-remora";
import { Button } from "@/components/ui/button";
import { WalletPicker } from "@/components/wallet-picker";
import {
  ClaudeCodeSteps,
  CommandGroups,
  GuideSection,
  MemoryFlow,
  ProofGrid,
} from "@/features/guide/guide-visuals";
import { useMe } from "@/features/me/use-me";
import { useOwner } from "@/features/remoras/hooks";

function Tiles({
  items,
}: {
  items: Array<{
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    detail: string;
  }>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.title}
          className="flex items-start gap-3 rounded-ob-card border border-ob-border-grouped bg-ob-grouped p-4"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ob-accent-soft text-ob-accent-text">
            <item.icon className="size-4" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{item.title}</p>
            <p className="text-md text-ob-muted">{item.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

const STEPS: Array<{ title: string; to?: string; detail: string }> = [
  {
    title: "Try a Researcher, no wallet",
    to: "/playground",
    detail: "A 1 USDC limit on testnet. Watch it pay.",
  },
  { title: "Sign in", detail: "With any Sui wallet." },
  {
    title: "Create a remora",
    to: "/remoras/new",
    detail: "Pick a kind, set its budget, sign once. It starts in practice mode.",
  },
  {
    title: "Use it",
    detail: "Ask or teach it. Why? shows the receipt. Go live when you trust it.",
  },
  {
    title: "Stay in control",
    to: "/approvals",
    detail: "Approvals for big payments, Funds for spend, Pause all to stop.",
  },
];

/** What each page is for, in the rail's order, then the pages the rail doesn't list. */
const PAGE_HELP: Record<string, string> = {
  "/": "Your remoras, what waits for you, what they did.",
  "/chat": "Talk to your remoras, here or in Telegram.",
  "/approvals": "Payments over a cap wait for your yes.",
  "/funds": "Your USDC and each spending limit.",
  "/memory": "What they remember, on Walrus.",
  "/connections": "Let Claude Code or Cursor use a remora.",
  "/hatchery": "Remoras people shared, to copy.",
  "/settings": "Notifications, Telegram, the panic switch.",
  "/verify": "Check any receipt against Sui.",
};
const MORE_PAGES = [
  {
    to: "/playground",
    label: "Try a Researcher",
    icon: Fish,
    help: "A Researcher, no wallet needed.",
  },
  {
    to: "/reef",
    label: "Services",
    icon: Store,
    help: "What a remora may buy, and the price.",
  },
  {
    to: "/status",
    label: "Status",
    icon: Activity,
    help: "Is Remora up right now?",
  },
];
const EVERY_PAGE = [
  ...[...RAIL_PAGES, ...RAIL_FOOTER]
    .filter((p) => PAGE_HELP[p.to])
    .map((p) => ({ to: p.to, label: p.label, icon: p.icon, help: PAGE_HELP[p.to] ?? "" })),
  ...MORE_PAGES,
];

export function GuidePage() {
  const { me } = useMe();
  const { owner } = useOwner();

  return (
    <Page
      title="How Remora works"
      index
      description="An always-on agent you own: memory you can read, a budget Sui enforces, a receipt for every action."
    >
      <PageHeader
        title="How Remora works"
        description="What it is, how to start, how it works."
        actions={
          // ADR-0103: one first step. Signed out, it's step 1 (try one, no wallet); signed in, chat.
          owner ? (
            <>
              <Button asChild>
                <Link to="/chat">
                  Open chat <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/remoras/new">Create a remora</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild>
                <Link to="/playground">
                  <Fish /> Try a Researcher, no wallet
                </Link>
              </Button>
              <WalletPicker label="Sign in" variant="outline" signIn />
            </>
          )
        }
      />

      <WhatIsRemora guideLink={false} />

      <GuideSection title="Start in five steps">
        <ol className="flex flex-col gap-2" data-testid="guide-steps">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="flex items-start gap-3 rounded-ob-card border border-ob-border-grouped bg-ob-grouped p-4"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ob-accent text-sm font-semibold text-white tabular-nums">
                {i + 1}
              </span>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">
                  {step.to ? (
                    <Link className="link" to={step.to}>
                      {step.title}
                    </Link>
                  ) : (
                    step.title
                  )}
                </p>
                <p className="text-md text-ob-muted">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </GuideSection>

      <GuideSection title="Every page" lead="Every page in the menu, then three more.">
        <ul className="grid gap-2 md:grid-cols-2" data-testid="guide-pages">
          {EVERY_PAGE.map((p) => (
            <li key={p.to}>
              <Link
                to={p.to}
                className="flex h-full items-start gap-3 rounded-ob-card border border-ob-border-grouped bg-ob-grouped p-3 hover:bg-ob-control-hover"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ob-accent-soft text-ob-accent-text">
                  <p.icon className="size-4" aria-hidden />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-ob-text">{p.label}</span>
                  <span className="text-md text-ob-muted">{p.help}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </GuideSection>

      <GuideSection title="Inside a remora">
        <Tiles
          items={[
            {
              icon: KeyRound,
              title: "A key",
              detail: "Its own Sui key. You can rotate or retire it.",
            },
            {
              icon: Brain,
              title: "Memory",
              detail: "What it learns, in Walrus Memory you can read.",
            },
            {
              icon: Gauge,
              title: "A budget",
              detail: "A spending limit caps every payment, enforced by Sui.",
            },
            {
              icon: Zap,
              title: "Triggers",
              detail: "A schedule, a question, or a wallet it watches.",
            },
          ]}
        />
      </GuideSection>

      <GuideSection
        title="Memory you can read"
        lead="Each fact is a line on Walrus. The newest wins."
      >
        <MemoryFlow />
        <Link className="link text-md" to="/memory">
          Open Memory
        </Link>
      </GuideSection>

      <GuideSection title="A budget Sui enforces" lead="Remoras never hold your money.">
        <Tiles
          items={[
            {
              icon: Wallet,
              title: "Your address balance",
              detail: "The only pot a spending limit can draw from.",
            },
            {
              icon: Gauge,
              title: "Its spending limit",
              detail: "A monthly limit and a per-payment cap, checked on chain.",
            },
            {
              icon: OctagonPause,
              title: "Pause or retire",
              detail: "Stop one remora, or all of them, with one signature.",
            },
            {
              icon: KeyRound,
              title: "A new key",
              detail: "Rotate it and the old key cannot spend anymore.",
            },
          ]}
        />
        <Link className="link text-md" to="/funds">
          Open Funds
        </Link>
      </GuideSection>

      <GuideSection title="Proof it works" lead="A receipt for every action, checkable by anyone.">
        <ProofGrid />
        <Link className="link text-md" to="/verify">
          Verify a receipt
        </Link>
      </GuideSection>

      {/* ADR-0103: the reference parts fold away; the page was 6,700 px with no contents. */}
      <details className="group">
        <summary className="cursor-pointer text-base font-semibold tracking-tight text-ob-text">
          Commands
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-md text-ob-muted">
            The same on the web, Telegram, Discord and the terminal.
          </p>
          <CommandGroups />
        </div>
      </details>

      <details className="group">
        <summary className="cursor-pointer text-base font-semibold tracking-tight text-ob-text">
          The same memory in Claude Code
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-md text-ob-muted">
            Once you own it, any agent you add as a delegate can read it through the Walrus Memory
            MCP.
          </p>
          <ClaudeCodeSteps />
        </div>
      </details>

      {me?.surveyUrl ? (
        <p className="text-md text-ob-muted">
          Used Remora for a bit?{" "}
          <a className="link" href={me.surveyUrl} target="_blank" rel="noreferrer">
            Tell me how it went
          </a>
          .
        </p>
      ) : null}
    </Page>
  );
}
