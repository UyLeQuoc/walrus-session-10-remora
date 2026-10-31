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
import {
  ClaudeCodeSteps,
  CommandGroups,
  GuideSection,
  MemoryFlow,
  ProofGrid,
} from "@/features/guide/guide-visuals";
import { useMe } from "@/features/me/use-me";

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
    title: "Try Scout, no wallet",
    to: "/playground",
    detail: "Ask a Scout with a $1 spending limit on testnet, and watch it pay for an answer.",
  },
  { title: "Sign in", detail: "Connect a Sui wallet with Sign in, at the bottom left." },
  {
    title: "Create a remora",
    to: "/remoras/new",
    detail:
      "Pick Scout or Sentinel, set its budget, and sign once. It starts in practice mode: it shows what it would pay, and pays nothing.",
  },
  {
    title: "Use it",
    detail:
      "Ask Scout or teach Sentinel on its page or in Chat. Why? under an answer shows its receipt. Press Go live once you trust it.",
  },
  {
    title: "Stay in control",
    to: "/approvals",
    detail:
      "A payment over its cap waits for you in Approvals. Funds shows what it spent, and Pause all stops every remora at once.",
  },
];

/** What each page is for, in the rail's order, then the pages the rail doesn't list. */
const PAGE_HELP: Record<string, string> = {
  "/": "Your remoras, what waits for you, and everything they did lately. Open a remora to ask or teach it, see its budget, cost and receipts, and what it learned.",
  "/chat":
    "Talk to your remoras: ask Scout, teach Sentinel. The same chat works in Telegram and Discord.",
  "/approvals":
    "A payment over a remora's cap waits here. Pay it once from your own wallet, or decline.",
  "/funds": "Your USDC, what each remora has spent of its limit, and Pause all.",
  "/memory":
    "Everything your remoras remember, stored on Walrus. Search it, hide or correct a memory, or export it.",
  "/connections":
    "Let another agent, like Claude Code or Cursor, use one of your remoras through MCP, within its spending limit.",
  "/hatchery": "Remoras other people shared. Use one to make your own copy, with your own budget.",
  "/settings": "Notifications, Telegram and the panic switch.",
  "/verify":
    "Paste a transaction digest or a receipt id and check it against Sui. No sign-in needed.",
};
const MORE_PAGES = [
  {
    to: "/playground",
    label: "Try Scout",
    icon: Fish,
    help: "A Scout with a $1 limit on testnet, no wallet needed.",
  },
  {
    to: "/reef",
    label: "Services",
    icon: Store,
    help: "The paid services a remora may buy from, and what each call costs.",
  },
  {
    to: "/status",
    label: "Status",
    icon: Activity,
    help: "Whether Remora's services are up right now.",
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

  return (
    <Page
      title="How Remora works"
      index
      description="An always-on agent you own: memory you can read, a budget Sui enforces, a receipt for every action."
    >
      <PageHeader
        title="How Remora works"
        description="What Remora is, how to start, what every page is for, and how it works underneath."
        actions={
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

      <GuideSection title="Every page" lead="The pages in the left rail, then three more.">
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

      <GuideSection
        title="Inside a remora"
        lead="Four parts: a key that acts, memory it can read, a budget it cannot exceed, and triggers that wake it."
      >
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
        <p className="text-md text-ob-muted">
          Start from Scout (buys answers) or Sentinel (watches wallets).{" "}
          <Link className="link" to="/remoras/new">
            Create one
          </Link>
          .
        </p>
      </GuideSection>

      <GuideSection
        title="Memory you can read"
        lead="Each fact is a typed line, encrypted on Walrus. Any chat or channel can recall it; the newest fact wins."
      >
        <MemoryFlow />
        <p className="text-md text-ob-muted">
          Browse every blob, search it, export it, or own it with your wallet in{" "}
          <Link className="link" to="/memory">
            Memory
          </Link>
          .
        </p>
      </GuideSection>

      <GuideSection
        title="A budget Sui enforces"
        lead="Remoras never hold your money. They spend from your address balance, only within a spending limit with a cap."
      >
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
        <p className="text-md text-ob-muted">
          See the split, move coins, and pause a budget in{" "}
          <Link className="link" to="/funds">
            Funds
          </Link>
          .
        </p>
      </GuideSection>

      <GuideSection
        title="A receipt for every action"
        lead="Every payment and answer leaves a receipt: what was bought, what it cost, and why."
      >
        <ProofGrid />
        <p className="text-md text-ob-muted">
          Paste a digest or a receipt id in{" "}
          <Link className="link" to="/verify">
            Verify a receipt
          </Link>{" "}
          and check it against Sui; no sign-in needed.
        </p>
      </GuideSection>

      <GuideSection
        title="Commands"
        lead="The same on the web, Telegram, Discord and the terminal."
      >
        <CommandGroups />
      </GuideSection>

      <GuideSection
        title="The same memory in Claude Code"
        lead="Once you own it, any agent you add as a delegate can read it through the official Walrus Memory MCP."
      >
        <ClaudeCodeSteps />
      </GuideSection>

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
