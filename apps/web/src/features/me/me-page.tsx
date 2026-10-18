import { useCurrentAccount } from "@mysten/dapp-kit";
import { Library } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { useShellTitle } from "@/app/shell";
import { Hash } from "@/components/hash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ChainPanel } from "@/features/me/chain-panel";
import { ChangesPanel } from "@/features/me/changes-panel";
import { ClaudeCodePanel } from "@/features/me/claude-code-panel";
import { ExportPanel } from "@/features/me/export-panel";
import { ImportPanel } from "@/features/me/import-panel";
import { MemoryList } from "@/features/me/memory-list";
import { StatStrip } from "@/features/me/stat-strip";
import { TeamCard } from "@/features/me/team-card";
import { useMe } from "@/features/me/use-me";
import { useUsage } from "@/features/me/use-usage";
import { WalletReadPanel } from "@/features/me/wallet-read-panel";
import { WalletSignIn } from "@/features/me/wallet-signin";
import { usePageMeta } from "@/hooks/use-page-meta";

const PAGE_META = {
  title: "My memory · hippo",
  description:
    "What hippo remembers about you, where it lives on Walrus and Sui, and the controls to export, hide or revoke it.",
  path: "/me",
  index: false,
};

export function MePage() {
  const { me, memories, error, load, signOut } = useMe();
  const usage = useUsage();
  const account = useCurrentAccount();
  const linked = Boolean(me?.walletAddress) || Boolean(account);
  useShellTitle("My memory");
  usePageMeta(PAGE_META);

  if (!me) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">{error || "Loading…"}</p>;
  }

  if (me.mode === "anonymous") {
    return (
      <Page>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-brand/15 text-brand">
              <Library />
            </EmptyMedia>
            <EmptyTitle>Nothing remembered yet</EmptyTitle>
            <EmptyDescription>
              Tell hippo something in the chat. It shows up here once it is on Walrus.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link to="/">Start chatting</Link>
            </Button>
          </EmptyContent>
        </Empty>
        {linked ? null : <WalletSignIn onSignedIn={load} />}
      </Page>
    );
  }

  const owned = me.mode === "owned";
  const stored = memories.filter((m) => m.status === "stored").length;

  return (
    <Page>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={owned ? "accent" : "outline"}>{owned ? "you own this" : "guest"}</Badge>
          <Badge variant="outline">{me.memoryEnabled ? "remembering" : "paused"}</Badge>
          {me.namespace ? (
            <span className="min-w-48 max-w-xs flex-1 text-sm text-muted-foreground">
              <Hash value={me.namespace} label="namespace" />
            </span>
          ) : null}
          {me.signedIn ? (
            <Button variant="outline" className="ml-auto" onClick={() => void signOut()}>
              Sign out
            </Button>
          ) : null}
        </div>
        {owned ? null : (
          <p className="text-sm text-muted-foreground">
            Right now hippo keeps it under its own account. Own it with a wallet below.
          </p>
        )}
      </div>

      <StatStrip stored={stored} total={memories.length} usage={usage} owned={owned} />

      {!me.signedIn && !linked ? <WalletSignIn onSignedIn={load} /> : null}

      <MemoryList
        memories={memories}
        uses={usage?.uses}
        onError={(message) => toast.error(message)}
        onChange={load}
      />

      {memories.some((m) => m.type === "correction" && m.status === "stored") ? (
        <ChangesPanel />
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <ChainPanel owned={owned} onError={(message) => toast.error(message)} />
        <div className="flex flex-col gap-6">
          {stored > 0 ? <ExportPanel onError={(message) => toast.error(message)} /> : null}
          <TeamCard />
        </div>
      </div>

      {stored > 0 ? <WalletReadPanel memories={memories} /> : null}

      <ImportPanel onSaved={load} />

      <ClaudeCodePanel owned={owned} />
    </Page>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
      {children}
    </div>
  );
}
