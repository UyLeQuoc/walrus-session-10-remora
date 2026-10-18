/**
 * Build one person's export from the database and the relayer. The logic lives
 * in `export.ts`, which touches neither; this only gathers its inputs.
 */
import { desc, eq, memoryIndex } from "@remora/db";
import { RelayerExtras } from "@remora/memory";
import { db } from "../context.ts";
import { env } from "../env/load.ts";
import { type Person, portFor } from "../identity/persons.ts";
import { assembleExport, type ExportFile, recoverText, renderMarkdown } from "./export.ts";

export async function exportFor(person: Person, channel: string): Promise<ExportFile> {
  const rows = await db
    .select()
    .from(memoryIndex)
    .where(eq(memoryIndex.personId, person.id))
    .orderBy(desc(memoryIndex.createdAt));
  const port = await portFor(person, channel, { includeHidden: true });
  const recovered = await recoverText((q) => port.recall(q), rows);

  // Expiry is best-effort, as on /me: the metadata route is flaky, and losing
  // it costs one column, not the file. It covers the primary account only.
  const expiry = new Map<string, string>();
  try {
    const extras = new RelayerExtras(port.scope);
    for (const m of await extras.allMemories())
      if (m.expires_at) expiry.set(m.blob_id, m.expires_at);
  } catch (e) {
    console.warn("[export] expiry lookup failed", e instanceof Error ? e.message : e);
  }

  const owned = person.mode === "owned" && Boolean(person.accountId);
  return assembleExport({
    now: new Date(),
    account: {
      mode: owned ? "owned" : "guest",
      accountId: owned && person.accountId ? person.accountId : env.MEMWAL_ACCOUNT_ID,
      owner: owned ? (person.walletAddress ?? null) : null,
    },
    rows,
    recovered,
    expiry,
  });
}

export interface ExportDownload {
  name: string;
  mime: string;
  content: string;
}

export function asDownload(file: ExportFile, format: "json" | "md"): ExportDownload {
  const day = file.exportedAt.slice(0, 10);
  return format === "md"
    ? {
        name: `hippo-memory-${day}.md`,
        mime: "text/markdown; charset=utf-8",
        content: renderMarkdown(file),
      }
    : {
        name: `hippo-memory-${day}.json`,
        mime: "application/json; charset=utf-8",
        content: `${JSON.stringify(file, null, 2)}\n`,
      };
}
