/**
 * `/guide` (N14, Q4): How Remora works in four blocks — an agent, memory, a budget, a receipt — each
 * with a picture, a sentence and a link to the page that does it. The Claude Code recipe stays.
 */
import { ArrowRight, Brain, Gauge, KeyRound, OctagonPause, Wallet, Zap } from "lucide-react";
import { Link } from "react-router";
import { Page, PageHeader } from "@/components/app/page";
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
        <div key={item.title} className="flex items-start gap-3 rounded-xl border bg-card p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <item.icon className="size-4" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{item.title}</p>
            <p className="text-sm text-muted-foreground">{item.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

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
        description="An always-on agent you own: memory you can read, a budget Sui enforces, and a receipt for every action."
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

      <GuideSection
        title="A remora"
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
              detail: "A Disc caps every payment, enforced by Sui.",
            },
            {
              icon: Zap,
              title: "Triggers",
              detail: "A schedule, a question, or a wallet it watches.",
            },
          ]}
        />
        <p className="text-sm text-muted-foreground">
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
        <p className="text-sm text-muted-foreground">
          Browse every blob, search it, export it, or own it with your wallet in{" "}
          <Link className="link" to="/memory">
            Memory
          </Link>
          .
        </p>
      </GuideSection>

      <GuideSection
        title="A budget Sui enforces"
        lead="Remoras never hold your money. They spend from your address balance, only through a Disc with a cap."
      >
        <Tiles
          items={[
            {
              icon: Wallet,
              title: "Your address balance",
              detail: "The only pot a Disc can spend from.",
            },
            {
              icon: Gauge,
              title: "Its Disc",
              detail: "A monthly limit and a per-payment cap, checked on chain.",
            },
            {
              icon: OctagonPause,
              title: "Pause or retire",
              detail: "Stop one remora, or every Disc, with one signature.",
            },
            {
              icon: KeyRound,
              title: "A new key",
              detail: "Rotate it and the old key cannot spend anymore.",
            },
          ]}
        />
        <p className="text-sm text-muted-foreground">
          See the split, move coins, and pause a budget in{" "}
          <Link className="link" to="/funds">
            Funds
          </Link>
          .
        </p>
      </GuideSection>

      <GuideSection
        title="A receipt for every action"
        lead="Every payment and answer leaves a Wake: what was bought, what it cost, and why."
      >
        <ProofGrid />
        <p className="text-sm text-muted-foreground">
          Paste a digest or a Wake id in{" "}
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
        <p className="text-sm text-muted-foreground">
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
