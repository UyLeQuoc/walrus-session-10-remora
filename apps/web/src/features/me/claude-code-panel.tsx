import { CopyButton } from "@/components/copy-button";
import { Section } from "@/features/me/section";

const SKILL_URL =
  "https://raw.githubusercontent.com/UyLeQuoc/walrus-session-8-chatbots/main/.claude/skills/hippo-memory/SKILL.md";

const INSTALL = "/plugin marketplace add MystenLabs/MemWal";
const PLUGIN = "/plugin install memwal@memwal-plugins";
const ASK = 'What does hippo know about me? Use memwal_recall with namespace "hippo".';

function Command({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-3 py-2 text-sm">
        {value}
      </code>
      <CopyButton value={value} label={label} />
    </div>
  );
}

export function ClaudeCodePanel({ owned }: { owned: boolean }) {
  return (
    <Section
      title="Use the same memory in Claude Code"
      description="Any agent you add as a delegate reads the same memory through the official Walrus Memory MCP."
    >
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
        {owned ? null : <li>Own your memory first: connect a wallet such as Slush above.</li>}
        <li className="flex flex-col gap-2">
          <span>In Claude Code, add the MemWal plugin.</span>
          <Command value={INSTALL} label="the marketplace command" />
          <Command value={PLUGIN} label="the install command" />
        </li>
        <li>Ask Claude Code to log in to Walrus Memory, and sign with the same wallet.</li>
        <li className="flex flex-col gap-2">
          <span>Ask what hippo knows.</span>
          <Command value={ASK} label="the question" />
        </li>
        <li>
          To have Claude Code read and write in hippo's format, add the{" "}
          <a className="underline" href={SKILL_URL} target="_blank" rel="noreferrer">
            hippo-memory skill
          </a>
          .
        </li>
      </ol>
      <p className="text-sm text-muted-foreground">
        A Google sign-in here gives an address only hippo uses, so this needs a wallet.
      </p>
    </Section>
  );
}
