/**
 * The words a slash command says, and the table the web draws from the same words.
 *
 * Telegram, Discord, Slack and the CLI send `text` and ignore `table`.
 */
import type { CommandTable } from "@remora/core/command-table";
import { explorer } from "@remora/memory";
import { HELP, PRIVACY, welcome } from "../copy/index.ts";

export interface CommandView {
  text: string;
  table: CommandTable;
}

export function sentence(text: string): CommandView {
  return { text, table: { columns: ["Detail"], rows: [{ cells: [text] }] } };
}

export function welcomeView(surveyUrl?: string): CommandView {
  const text = welcome(surveyUrl);
  const parts = text
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return {
    text,
    table: {
      columns: ["Detail"],
      rows: parts.map((part) =>
        surveyUrl && part.includes(surveyUrl)
          ? { cells: [part], copy: surveyUrl, href: surveyUrl }
          : { cells: [part] },
      ),
    },
  };
}

const HELP_COMMANDS = [
  "/memory search <q>",
  "/memory forget <b>",
  "/memory off | on",
  "/disconnect",
  "/compare",
  "/connect",
  "/privacy",
  "/whoami",
  "/export",
  "/memory",
  "/proof",
  "/help",
  "/link",
];

function helpRows(): CommandTable["rows"] {
  const rows: CommandTable["rows"] = [];
  for (const line of HELP.split("\n")) {
    const command = HELP_COMMANDS.find((name) => line.startsWith(name));
    if (!command) continue;
    const what = line.slice(command.length).trim();
    if (!what) continue;
    rows.push({ cells: [command, what] });
  }
  return rows;
}

export function helpView(unknown = false): CommandView {
  const intro = HELP.split("\n")[0] ?? "";
  return {
    text: unknown ? `Unknown command. ${HELP}` : HELP,
    table: {
      lead: unknown ? `Unknown command. ${intro}` : intro,
      columns: ["Command", "What it does"],
      rows: helpRows(),
    },
  };
}

export function privacyView(): CommandView {
  const rows = PRIVACY.split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({ cells: [line.replace(/^•\s+/, "")] }));
  return { text: PRIVACY, table: { columns: ["Detail"], rows } };
}

export function whoamiView(input: {
  mode: "owned" | "guest";
  namespace: string;
  accountId: string | null;
  walletAddress: string | null;
  written: number;
  relay: { count: number; bytes: number } | null;
}): CommandView {
  const lead =
    input.mode === "owned"
      ? "Mode: owned. This memory is in your own Walrus Memory account."
      : "Mode: guest. Your memory sits under hippo's account until you run /connect.";
  const lines = [lead, `Namespace: ${input.namespace}`];
  const rows: CommandTable["rows"] = [
    { cells: ["Namespace", input.namespace], copy: input.namespace },
  ];
  if (input.accountId) {
    lines.push(`Account: ${input.accountId}`, explorer.object(input.accountId));
    rows.push({
      cells: ["Account", input.accountId],
      copy: input.accountId,
      href: explorer.object(input.accountId),
    });
  }
  if (input.walletAddress) {
    lines.push(`Wallet: ${input.walletAddress}`);
    rows.push({
      cells: ["Wallet", input.walletAddress],
      copy: input.walletAddress,
      href: explorer.address(input.walletAddress),
    });
  }
  lines.push(`Memories written by hippo: ${input.written}`);
  rows.push({ cells: ["Memories hippo wrote", String(input.written)] });
  if (input.relay) {
    lines.push(`Namespace total on the relayer: ${input.relay.count} (${input.relay.bytes} bytes)`);
    rows.push({
      cells: ["On the relayer", `${input.relay.count} (${input.relay.bytes} bytes)`],
    });
  }
  return {
    text: lines.join("\n"),
    table: { lead, columns: ["Field", "Value"], rows },
  };
}

export interface MemoryListItem {
  type: string;
  createdAt: Date;
  blobId: string | null;
  hidden: boolean;
}

export function memoryListView(items: MemoryListItem[]): CommandView {
  if (!items.length) {
    return sentence("I have not written anything about you yet. Tell me something worth keeping.");
  }
  const byType = new Map<string, number>();
  for (const item of items) byType.set(item.type, (byType.get(item.type) ?? 0) + 1);
  const summary = [...byType.entries()].map(([type, count]) => `${type} ${count}`).join(", ");
  const lead = `${items.length} memories (${summary}).`;
  const foot =
    "Use /memory search <question> to read them back, and /memory forget <blob> to stop me using one.";
  const recent = items.slice(0, 10);
  const bullets = recent
    .map((item) => {
      const where = item.blobId ? `blob ${item.blobId.slice(0, 10)}…` : "writing to Walrus…";
      const hidden = item.hidden ? " · hidden" : "";
      return `• [${item.type}] ${item.createdAt.toISOString().slice(0, 10)} · ${where}${hidden}`;
    })
    .join("\n");
  return {
    text: `${lead}\n\n${bullets}\n\n${foot}`,
    table: {
      lead,
      columns: ["Type", "Date", "Blob"],
      rows: recent.map((item) => {
        const date = item.createdAt.toISOString().slice(0, 10);
        if (!item.blobId) return { cells: [item.type, date, "writing to Walrus…"] };
        return {
          cells: [item.hidden ? `${item.type} · hidden` : item.type, date, item.blobId],
          copy: item.blobId,
          href: explorer.blobExplorer(item.blobId),
        };
      }),
      foot,
    },
  };
}

export function searchView(
  query: string,
  hits: Array<{ text: string; distance: number; blobId: string }>,
): CommandView {
  if (!hits.length) return sentence(`Nothing close to "${query}".`);
  const lines = hits.map((hit) => {
    const relevance = (1 - hit.distance).toFixed(2);
    return `• ${hit.text}\n  relevance ${relevance} · blob ${hit.blobId.slice(0, 10)}…`;
  });
  return {
    text: lines.join("\n"),
    table: {
      columns: ["Memory", "Relevance"],
      rows: hits.map((hit) => ({
        cells: [hit.text, (1 - hit.distance).toFixed(2)],
        copy: hit.blobId,
        href: explorer.blobExplorer(hit.blobId),
      })),
    },
  };
}

export function compareView(answer: string, used: number): CommandView {
  const lead = `Without the ${used} ${used === 1 ? "memory" : "memories"} my last answer used, I would have said:`;
  return {
    text: `${lead}\n\n${answer}`,
    table: { lead, columns: ["Without memory"], rows: [{ cells: [answer] }] },
  };
}

export function proofView(
  items: Array<{ type: string; distance: number; blobId: string }>,
): CommandView {
  if (!items.length) return sentence("My last answer used no stored memory.");
  const lead = `My last answer used ${items.length} memories:`;
  const lines = items.map(
    (item) =>
      `• ${item.type} · relevance ${(1 - item.distance).toFixed(2)}\n  ${explorer.blobExplorer(item.blobId)}`,
  );
  return {
    text: `${lead}\n${lines.join("\n")}`,
    table: {
      lead,
      columns: ["Type", "Relevance"],
      rows: items.map((item) => ({
        cells: [item.type, (1 - item.distance).toFixed(2)],
        copy: item.blobId,
        href: explorer.blobExplorer(item.blobId),
      })),
    },
  };
}

export function linkCodeView(code: string, expiresInMinutes: number): CommandView {
  const text = `Your link code is ${code}.\n\nOpen hippo on another channel (the web chat, Telegram, Discord, Slack or the CLI) and send:\n/link ${code}\n\nBoth conversations then share one memory. The code works once and expires in ${expiresInMinutes} minutes.\n\nKeep it to yourself. Anyone who redeems it joins your memory.`;
  return {
    text,
    table: {
      lead: `Your link code is ${code}.`,
      columns: ["Code"],
      rows: [{ cells: [code], copy: code }],
      foot: `Open hippo on another channel (the web chat, Telegram, Discord, Slack or the CLI) and send /link ${code}. Both conversations then share one memory. The code works once and expires in ${expiresInMinutes} minutes. Keep it to yourself. Anyone who redeems it joins your memory.`,
    },
  };
}

export function connectLinkView(url: string): CommandView {
  const foot =
    "You sign one transaction, gas is normally sponsored, and you can revoke me at any time. Everything I already know stays readable: it sits in my account and cannot be moved, so I read both from then on. New memories go only to yours.";
  return {
    text: `Own your memory in your own Walrus Memory account:\n${url}\n\n${foot}`,
    table: {
      lead: "Own your memory in your own Walrus Memory account.",
      columns: ["Link"],
      rows: [{ cells: [url], copy: url, href: url }],
      foot,
    },
  };
}

export function disconnectLinkView(url: string): CommandView {
  const foot =
    "After it lands I cannot read or write anything in your account, within about a minute. What you told me before you connected is the exception: that lives in my account, not yours, and I can still read it. /memory forget all makes it unrecallable.";
  return {
    text: `Revoke my access on-chain:\n${url}\n\n${foot}`,
    table: {
      lead: "Revoke my access on-chain.",
      columns: ["Link"],
      rows: [{ cells: [url], copy: url, href: url }],
      foot,
    },
  };
}

const EXPORT_CAVEAT =
  "The file lists every blob on Walrus. It cannot let you decrypt them without me yet; it says why inside.";

export function exportSummary(memories: number, withText: number, verified: number): string {
  return `${memories} memories. Text recovered for ${withText} of them, and ${verified} match the fingerprint I recorded when I wrote them.`;
}

export function exportAttachedView(summary: string): { text: string } {
  return {
    text: `Your memory, as files you keep. ${summary}\n\nThe .md is for reading, the .json is the complete record. ${EXPORT_CAVEAT}`,
  };
}

export function exportWebView(summary: string, pageUrl: string): CommandView {
  const where = `Download it from the Export button on ${pageUrl}.`;
  return {
    text: `${summary}\n\n${where} ${EXPORT_CAVEAT}`,
    table: {
      lead: summary,
      columns: ["Page"],
      rows: [{ cells: [pageUrl], copy: pageUrl, href: pageUrl }],
      foot: `${where} ${EXPORT_CAVEAT}`,
    },
  };
}

export function exportElsewhereView(summary: string, pageUrl: string): CommandView {
  const where = `I cannot send files on this channel yet. /link it to the web chat, then use Export on ${pageUrl}.`;
  return sentence(`${summary}\n\n${where} ${EXPORT_CAVEAT}`);
}

export function hiddenMemoryView(input: {
  hide: boolean;
  type: string;
  blobId: string;
  owned: boolean;
}): CommandView {
  const short = `${input.blobId.slice(0, 10)}…`;
  if (!input.hide) {
    const text = `I will use that ${input.type} memory again (blob ${short}).`;
    return { text, table: { columns: ["Detail"], rows: [{ cells: [text], copy: input.blobId }] } };
  }
  const elsewhere = input.owned ? " Other apps signed in to your account can still recall it." : "";
  const text = `I will not use that ${input.type} memory again (blob ${short}).\n\nIt is still on Walrus, encrypted, because nothing there can be deleted yet.${elsewhere} /memory unhide ${input.blobId.slice(0, 10)} brings it back.`;
  return { text, table: { columns: ["Detail"], rows: [{ cells: [text], copy: input.blobId }] } };
}

export function forgetUsageView(): CommandView {
  const text =
    "/memory forget <blob>  stop me using one memory: the blob shown by /memory or /memory search\n/memory forget all     make everything unrecallable\n\nNothing is deleted from Walrus either way; that is not possible yet.";
  return {
    text,
    table: {
      columns: ["Command", "What it does"],
      rows: [
        {
          cells: [
            "/memory forget <blob>",
            "stop me using one memory: the blob shown by /memory or /memory search",
          ],
        },
        { cells: ["/memory forget all", "make everything unrecallable"] },
      ],
      foot: "Nothing is deleted from Walrus either way; that is not possible yet.",
    },
  };
}
