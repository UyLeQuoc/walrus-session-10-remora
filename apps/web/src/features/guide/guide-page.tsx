import { ArrowRight, Users } from "lucide-react";
import { Link } from "react-router";
import { useShellTitle } from "@/app/shell";
import { DiscordButton, TelegramButton } from "@/components/channel-links";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChannelPair,
  ChatVsMemory,
  ClaudeCodeSteps,
  CommandGroups,
  GuideSection,
  MemoryFlow,
  OwnershipPath,
  ProofGrid,
} from "@/features/guide/guide-visuals";
import { useMe } from "@/features/me/use-me";
import { usePageMeta } from "@/hooks/use-page-meta";

const PAGE_META = {
  title: "How hippo works · memory on Walrus, owned on Sui",
  description:
    "How hippo stores what you tell it on Walrus, recalls it before every reply, and hands it to your own Sui account, with a key you can revoke on chain.",
  path: "/guide",
  index: true,
};

export function GuidePage() {
  const { me } = useMe();
  useShellTitle("How it works");
  usePageMeta(PAGE_META);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-12 overflow-y-auto px-4 py-8">
      <header className="flex flex-col items-start gap-4">
        <Badge variant="outline">How it works</Badge>
        <h1 className="font-greeting text-4xl leading-tight text-balance sm:text-5xl">
          A chatbot that remembers you, on memory you own
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          hippo keeps the facts you tell it on Walrus, in a Sui account you can own. It only holds a
          key, and you can take it back.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/">
              Start chatting
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/me">See my memory</Link>
          </Button>
          <TelegramButton />
          <DiscordButton />
        </div>
      </header>

      <GuideSection title="The life of a memory">
        <MemoryFlow />
      </GuideSection>

      <GuideSection
        title="One memory, on the web, Telegram and Discord"
        lead="Type /link in one, send the code in another, and they all read the same memory."
      >
        <ChannelPair />
      </GuideSection>

      <GuideSection
        title="The chat and the memory are different things"
        lead="/memory off stops new facts. It deletes nothing."
      >
        <ChatVsMemory />
      </GuideSection>

      <GuideSection
        title="Guest first, then yours"
        lead="Facts from guest time stay in hippo's account. New ones go to yours."
      >
        <OwnershipPath />
      </GuideSection>

      <GuideSection title="Check it yourself" lead="Nothing here asks you to take hippo's word.">
        <ProofGrid />
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

      <section className="flex flex-col items-start gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand [&_svg]:size-4">
          <Users />
        </span>
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-sm font-medium">Share with a team</p>
          <p className="text-sm text-muted-foreground">
            Only what you add is shared. Your own memory stays yours.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/team">Open team</Link>
        </Button>
      </section>

      {me?.surveyUrl ? (
        <p className="text-sm text-muted-foreground">
          Used hippo for a bit?{" "}
          <a className="underline" href={me.surveyUrl} target="_blank" rel="noreferrer">
            Tell me how it went
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
