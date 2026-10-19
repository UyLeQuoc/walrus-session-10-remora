/**
 * Memory → Chat (D6): what Remora remembers from the chat, where it lives on Walrus and Sui, and the
 * controls to export, hide or revoke it. The old `/me` page lives here as the second tab.
 */
import { Library } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Page } from "@/components/app/page";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ChainPanel } from "@/features/me/chain-panel";
import { ChangesPanel } from "@/features/me/changes-panel";
import { ClaudeCodePanel } from "@/features/me/claude-code-panel";
import { ExportPanel } from "@/features/me/export-panel";
import { ImportPanel } from "@/features/me/import-panel";
import { MemoryList } from "@/features/me/memory-list";
import { StatStrip } from "@/features/me/stat-strip";
import { useMe } from "@/features/me/use-me";
import { useUsage } from "@/features/me/use-usage";
import { WalletReadPanel } from "@/features/me/wallet-read-panel";
import { WalletSignIn } from "@/features/me/wallet-signin";

export function ChatMemory() {
  const { me, memories, error, load } = useMe();
  const usage = useUsage();
  const linked = Boolean(me?.walletAddress);

  if (!me) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-24 w-full" />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    );
  }

  if (me.mode === "anonymous") {
    return (
      <div className="flex flex-col gap-6">
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-primary/15 text-primary">
              <Library />
            </EmptyMedia>
            <EmptyTitle>Nothing remembered yet</EmptyTitle>
            <EmptyDescription>
              Tell a remora something in the chat. It shows up here once it is on Walrus.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link to="/chat">Start chatting</Link>
            </Button>
          </EmptyContent>
        </Empty>
        {linked ? null : <WalletSignIn onSignedIn={load} />}
      </div>
    );
  }

  const owned = me.mode === "owned";
  const stored = memories.filter((m) => m.status === "stored").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={owned ? "accent" : "outline"}>
            {owned ? "you own this" : "Not owned yet"}
          </Badge>
          <Badge variant="outline">{me.memoryEnabled ? "remembering" : "paused"}</Badge>
          {me.namespace ? (
            <span className="min-w-48 max-w-xs flex-1 text-sm text-muted-foreground">
              <Hash value={me.namespace} label="namespace" />
            </span>
          ) : null}
        </div>
        {owned ? null : (
          <p className="text-sm text-muted-foreground">
            Right now Remora keeps it under its own account. Own it with a wallet below.
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

      <ChainPanel owned={owned} onError={(message) => toast.error(message)} />

      {stored > 0 ? <ExportPanel onError={(message) => toast.error(message)} /> : null}

      {stored > 0 ? <WalletReadPanel memories={memories} /> : null}

      <ImportPanel onSaved={load} />

      <ClaudeCodePanel owned={owned} />
    </div>
  );
}

/** `/me` is kept as a thin route for old links and tests; it renders the Chat tab content. */
export function MePage() {
  return (
    <Page title="Memory" description="What Remora remembers from the chat.">
      <ChatMemory />
    </Page>
  );
}
