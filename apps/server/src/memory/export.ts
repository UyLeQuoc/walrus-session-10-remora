/**
 * The memory export: everything hippo can honestly hand back, and a plain
 * statement of what it cannot.
 *
 * "Your memory is yours" needs a file the person keeps. What can go in it is
 * decided by what Walrus Memory allows, not by what would look good:
 *
 * - **Metadata, always.** Blob id, type, date, channel, namespace, account,
 *   storage expiry, and links to the public ciphertext. Enough to find every
 *   memory on Walrus without hippo.
 * - **Text, when recall returns it.** There is no read-by-blob-id and no bulk
 *   read; recall is the only way text comes back, a hundred at a time. So text
 *   is recovered by recalling on each type tag until every blob is found.
 * - **Verified text.** hippo recorded the sha256 of every line it wrote. A
 *   recovered line is marked verified only if it hashes to that value, so the
 *   file proves it holds exactly what was written, not whatever came back.
 * - **Never the ability to decrypt it yourself.** The relayer seals with a key
 *   server the SDK does not list, behind an aggregator that needs an API key
 *   (docs/issues/12). The file says so rather than implying otherwise.
 *
 * Nothing here touches the database or the environment, so it is tested in CI
 * without credentials. The export is built per request and never stored:
 * memory text does not go into Postgres, and that includes a cached file.
 */
import { createHash } from "node:crypto";
import { explorer, MEMORY_TYPES, NAMESPACE, parseMemoryText } from "@remora/memory";

/** One `memory_index` row, as much of it as the export needs. */
export interface IndexRow {
  blobId: string | null;
  type: string;
  status: string;
  channel: string;
  namespace: string;
  accountId: string;
  createdAt: Date;
  textSha256: string;
  hiddenAt?: Date | null;
}

/** The shape recall returns, narrowed to what recovery reads. */
export interface RecalledLine {
  blob_id: string;
  text: string;
}

export type Recall = (input: {
  query: string;
  limit: number;
  maxDistance: number;
}) => Promise<RecalledLine[]>;

export interface Recovered {
  /** The exact stored line, prefix included. This is what the hash covers. */
  line: string;
  verified: boolean;
}

/** Every memory's line starts with its type tag, so each tag is a query. */
export const RECOVERY_QUERIES = MEMORY_TYPES.map((t) => `[${t}]`);

/** The relayer caps a single recall at 100 results. */
const RECALL_CAP = 100;

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Recover the text of every stored memory recall will give back.
 *
 * Sequential, and stops as soon as everything is found: concurrent recalls make
 * the relayer drop matches (docs/SPIKES.md §H), and each one decrypts up to a
 * hundred blobs against a shared budget. A failed query costs coverage, not the
 * export.
 */
export async function recoverText(
  recall: Recall,
  rows: IndexRow[],
): Promise<Map<string, Recovered>> {
  const wanted = new Map<string, string>();
  for (const r of rows) if (r.blobId && r.status === "stored") wanted.set(r.blobId, r.textSha256);
  const found = new Map<string, Recovered>();
  for (const query of RECOVERY_QUERIES) {
    if (found.size === wanted.size) break;
    let hits: RecalledLine[];
    try {
      // Distance is irrelevant here; everything in the namespace is wanted.
      hits = await recall({ query, limit: RECALL_CAP, maxDistance: 2 });
    } catch (err) {
      console.warn("[export] recovery recall failed", err instanceof Error ? err.message : err);
      continue;
    }
    for (const h of hits) {
      const expected = wanted.get(h.blob_id);
      if (expected === undefined || found.has(h.blob_id)) continue;
      found.set(h.blob_id, { line: h.text, verified: sha256Hex(h.text) === expected });
    }
  }
  return found;
}

export interface ExportAccount {
  mode: "guest" | "owned";
  accountId: string;
  owner: string | null;
}

export interface ExportedMemory {
  blobId: string;
  type: string;
  createdAt: string;
  channel: string;
  /** `own` for this person's memory, `team` for a fact they added to a team. */
  scope: "own" | "team";
  namespace: string;
  accountId: string;
  expiresAt: string | null;
  ciphertextUrl: string;
  explorerUrl: string;
  /** sha256 of the stored line, recorded by hippo when it wrote the memory. */
  sha256: string;
  /** The fact alone, without the format prefix. Absent when not recovered. */
  text?: string;
  /** The exact stored line. Absent when not recovered. */
  line?: string;
  /** True when `line` hashes to `sha256`. Null when there is no text to check. */
  verified: boolean | null;
  /** The person asked hippo to stop using it. It is still theirs, and here. */
  hidden: boolean;
}

export interface ExportFile {
  format: "hippo-export/1";
  exportedAt: string;
  account: ExportAccount & { explorerUrl: string };
  coverage: {
    memories: number;
    withText: number;
    verified: number;
    stillWriting: number;
    neverLanded: number;
  };
  limits: string[];
  memories: ExportedMemory[];
}

export function assembleExport(input: {
  now: Date;
  account: ExportAccount;
  rows: IndexRow[];
  recovered: Map<string, Recovered>;
  expiry: Map<string, string>;
  /** The team the person is in now, if any. Its memory is not in the file. */
  teamName?: string | null;
}): ExportFile {
  const stored = input.rows.filter(
    (r): r is IndexRow & { blobId: string } => r.status === "stored" && Boolean(r.blobId),
  );
  const memories: ExportedMemory[] = stored.map((r) => {
    const got = input.recovered.get(r.blobId);
    const parsed = got ? parseMemoryText(got.line) : null;
    return {
      blobId: r.blobId,
      type: r.type,
      createdAt: r.createdAt.toISOString(),
      channel: r.channel,
      scope: NAMESPACE.isTeam(r.namespace) ? "team" : "own",
      namespace: r.namespace,
      accountId: r.accountId,
      expiresAt: input.expiry.get(r.blobId) ?? null,
      ciphertextUrl: explorer.blob(r.blobId),
      explorerUrl: explorer.blobExplorer(r.blobId),
      sha256: r.textSha256,
      ...(got ? { text: parsed?.text ?? got.line, line: got.line } : {}),
      verified: got ? got.verified : null,
      hidden: Boolean(r.hiddenAt),
    };
  });

  const withText = memories.filter((m) => m.line !== undefined).length;
  const verified = memories.filter((m) => m.verified === true).length;
  const limits = [
    `Text is recovered by asking Walrus Memory for it, because there is no way to read a memory by its blob id. ${withText} of ${memories.length} came back, and ${verified} match the fingerprint hippo recorded when it wrote them.`,
    "You cannot decrypt the ciphertext links yourself today. The relayer seals each memory with a key server the Walrus Memory SDK does not list, behind an aggregator that needs an API key. The bytes are public and listed here; reading them still goes through the relayer (hippo docs/issues/12).",
    "Storage on Walrus is paid for a fixed period. Each memory's expiry is listed where the relayer reported one.",
  ];
  if (input.account.mode === "guest") {
    limits.push(
      "These memories are in hippo's own Walrus Memory account, not yours. /connect moves new memories into an account your wallet owns; what is listed here stays where it is.",
    );
  }
  if (input.teamName || memories.some((m) => m.scope === "team")) {
    // Team writes are indexed per person only from the 2026-09-24 deploy on;
    // before it `/team remember` recorded nothing, so there is nothing to list.
    limits.push(
      "Memories marked team are ones you added with /team remember. They belong to the team's shared memory, and leaving the team does not remove them. What teammates added is theirs and is not in this file, and nothing added before hippo began recording team writes is listed.",
    );
  }

  return {
    format: "hippo-export/1",
    exportedAt: input.now.toISOString(),
    account: { ...input.account, explorerUrl: explorer.object(input.account.accountId) },
    coverage: {
      memories: memories.length,
      withText,
      verified,
      stillWriting: input.rows.filter((r) => r.status === "pending").length,
      neverLanded: input.rows.filter((r) => r.status === "failed").length,
    },
    limits,
    memories,
  };
}

/** The same export for a person to read. The JSON is the one to keep. */
export function renderMarkdown(file: ExportFile): string {
  const out = [
    "# Your memory in hippo",
    "",
    `Exported ${file.exportedAt.slice(0, 16).replace("T", " ")} UTC.`,
    "",
    file.account.mode === "owned"
      ? `Held in **your** Walrus Memory account, [${short(file.account.accountId)}](${file.account.explorerUrl}), owned by \`${file.account.owner ?? "unknown"}\`.`
      : `Held in **hippo's** Walrus Memory account, [${short(file.account.accountId)}](${file.account.explorerUrl}), until you run /connect.`,
    "",
    `${file.coverage.memories} memories. Text recovered for ${file.coverage.withText}, verified for ${file.coverage.verified}.`,
  ];
  if (file.coverage.stillWriting) out.push(`${file.coverage.stillWriting} still being written.`);
  if (file.coverage.neverLanded) {
    out.push(`${file.coverage.neverLanded} never reached Walrus and are not listed.`);
  }
  out.push("", "## What this file cannot do", "", ...file.limits.map((l) => `- ${l}`));

  // Known types in their usual order, then anything else, so no row is dropped.
  const types = [
    ...MEMORY_TYPES,
    ...new Set(file.memories.map((m) => m.type).filter((t) => !MEMORY_TYPES.some((k) => k === t))),
  ];
  for (const type of types) {
    const group = file.memories.filter((m) => m.type === type);
    if (!group.length) continue;
    out.push("", `## ${type}`, "");
    for (const m of group) {
      const text = m.text ?? "_text not recovered_";
      const mark =
        m.verified === true ? "verified" : m.verified === false ? "**did not verify**" : "";
      out.push(
        `- ${text}  `,
        `  ${m.createdAt.slice(0, 10)} · ${m.channel}${m.scope === "team" ? " · team" : ""}${m.hidden ? " · hidden" : ""}${mark ? ` · ${mark}` : ""} · [blob](${m.explorerUrl})${m.expiresAt ? ` · expires ${m.expiresAt.slice(0, 10)}` : ""}`,
      );
    }
  }
  return `${out.join("\n")}\n`;
}

function short(id: string): string {
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}
