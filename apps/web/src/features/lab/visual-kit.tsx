/**
 * `/lab/visual` (U14, ADR-0103): every piece of the visual kit on one page, so a review can look at
 * the kit by itself. The values are samples for the kit, never shown as a remora's data.
 */
import { ArrowRightLeft, Bot, Fuel, Shield, Store, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Page, PageHeader } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import {
  Amount,
  Checks,
  Digest,
  Empty,
  ExpiryBar,
  Flow,
  Hint,
  Meter,
  Receipt,
  Ring,
  Spark,
  Stat,
  StatRow,
  StatusDot,
  Steps,
  Timeline,
} from "@/components/visual";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const DIGEST = "7NYf3QGEp6bJxD3Zr1qHn8C5wVtK2yLmA9sFeUoRiTgP";

function Piece({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-xs text-ob-muted">{name}</h2>
      {children}
    </section>
  );
}

export function VisualKit() {
  return (
    <Page title="Visual kit">
      <PageHeader title="Visual kit" description="Sample values, for the kit only." />
      <div className="grid gap-10 xl:grid-cols-2">
        <Piece name="Stat · StatRow">
          <StatRow>
            <Stat label="Remoras live" value="3" />
            <Stat label="Spent today" value="0.42" unit="USDC" of="of 1.00" />
            <Stat label="Waiting for you" value="1" tone="warning" />
            <Stat label="Memories" value="360" />
          </StatRow>
        </Piece>
        <Piece name="Meter · Ring">
          <div className="flex flex-col gap-4">
            <Meter
              value={0.42}
              max={1}
              label="Spent today"
              left="0.42 of 1.00 USDC"
              right="today"
            />
            <Meter
              value={0.86}
              max={1}
              label="Spent this week"
              left="0.86 of 1.00 USDC"
              right="this week"
            />
            <Meter
              value={1}
              max={1}
              label="Spent this month"
              left="1.00 of 1.00 USDC"
              right="this month"
            />
            <div className="flex items-center gap-3">
              <Ring value={30} max={100} label="30%" />
              <Ring value={85} max={100} label="85%" />
              <Ring value={100} max={100} label="100%" size={36} />
            </div>
          </div>
        </Piece>
        <Piece name="Flow">
          <Flow
            label="Where the money goes"
            nodes={[
              { id: "you", label: "Your address", icon: <Wallet />, sub: "USDC stays here" },
              {
                id: "limit",
                label: "Spending limit",
                icon: <Shield />,
                sub: "1.00 / month",
                tone: "accent",
              },
              { id: "remora", label: "Researcher", icon: <Bot />, sub: "0 SUI" },
              { id: "svc", label: "Paid service", icon: <Store />, sub: "0.01" },
            ]}
            edges={[undefined, "x402", "pays"]}
            active={2}
          />
          <Flow
            label="A payment the limit stops"
            nodes={[
              { id: "remora", label: "Researcher", icon: <Bot /> },
              { id: "limit", label: "Spending limit", icon: <Shield />, tone: "danger" },
              { id: "x", label: "Unknown payee", icon: <ArrowRightLeft /> },
            ]}
            blockedAt={1}
          />
        </Piece>
        <Piece name="Steps">
          <Steps
            label="Playground"
            current={2}
            steps={[{ label: "Start" }, { label: "Ask" }, { label: "Pay" }, { label: "Verify" }]}
          />
        </Piece>
        <Piece name="Timeline">
          <Timeline
            label="Activity"
            items={[
              {
                id: "1",
                kind: "paid",
                title: "Sui risk check",
                amount: <Amount value="10000" />,
                at: ago(4),
              },
              { id: "2", kind: "learned", title: "Ignore transfers under 1 USDC", at: ago(40) },
              { id: "3", kind: "pinged", title: "New token in your wallet", at: ago(90) },
              { id: "4", kind: "blocked", title: "Payee not on the list", at: ago(300) },
            ]}
          />
        </Piece>
        <Piece name="Receipt">
          <div className="flex flex-wrap gap-4">
            <Receipt
              amount="0.01"
              payee="Sui risk check"
              at={ago(4)}
              verified
              proof={<Digest value={DIGEST} />}
            />
            <Receipt amount="0.01" payee="Odds" verified={null} compact />
          </div>
        </Piece>
        <Piece name="Checks">
          <Checks
            label="Safety layers"
            layout="row"
            items={[
              { label: "Safety check", state: "pass", icon: <Shield />, detail: "Listed service" },
              { label: "Gas station", state: "pass", icon: <Fuel />, detail: "Sponsored" },
              {
                label: "Spending limit",
                state: "fail",
                icon: <Wallet />,
                detail: "Not an allowed payee",
              },
            ]}
          />
        </Piece>
        <Piece name="ExpiryBar · Spark · StatusDot · Hint">
          <div className="flex flex-wrap items-center gap-6">
            <ExpiryBar days={190} />
            <ExpiryBar days={45} />
            <ExpiryBar days={12} />
            <Spark values={[0.2, 0.4, 0.35, 0.6, 0.8, 0.9]} label="Score rising: 0.2 to 0.9" />
            <span className="flex items-center gap-2 text-sm">
              <StatusDot state="ok" label="ok" /> ok
              <StatusDot state="degraded" label="degraded" /> degraded
              <StatusDot state="down" label="down" /> down
            </span>
            <span className="flex items-center gap-1 text-sm">
              Spending limit
              <Hint>Sui enforces it: the remora's key can't spend past it.</Hint>
            </span>
          </div>
        </Piece>
        <Piece name="Empty">
          <Empty title="No remoras yet." action={<Button size="sm">New remora</Button>} />
        </Piece>
      </div>
    </Page>
  );
}
