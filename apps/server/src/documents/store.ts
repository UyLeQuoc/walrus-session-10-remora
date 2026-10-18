import { and, desc, documents, eq, isNull, messageAttachments } from "@remora/db";
import { decryptSecret, encryptSecret } from "@remora/memory";
import { db } from "../context.ts";
import { env } from "../env/load.ts";
import type { Person } from "../identity/persons.ts";
import { documentValues, fileOwner, type RecordInput, sealIdBelongsTo } from "./rules.ts";

export interface StoredDocument {
  id: string;
  name: string;
  blobId: string;
  sealId: string;
  accountId: string;
  mediaType: string;
  byteSize: number;
  createdAt: string;
}

export type RecordResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not-owned" | "wrong-seal" };

function sealName(name: string): string {
  return encryptSecret(name, env.KEY_ENCRYPTION_KEY);
}

function openName(nameEnc: string): string | null {
  try {
    return decryptSecret(nameEnc, env.KEY_ENCRYPTION_KEY);
  } catch {
    return null;
  }
}

export async function recordDocument(person: Person, input: RecordInput): Promise<RecordResult> {
  const owner = fileOwner(person);
  if (!owner) return { ok: false, reason: "not-owned" };
  if (!sealIdBelongsTo(input.sealId, owner.walletAddress))
    return { ok: false, reason: "wrong-seal" };
  const [created] = await db
    .insert(documents)
    .values(documentValues(person.id, owner, input, sealName))
    .onConflictDoNothing()
    .returning({ id: documents.id });
  if (created) return { ok: true, id: created.id };
  const [existing] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.personId, person.id), eq(documents.blobId, input.blobId)))
    .limit(1);
  if (!existing) throw new Error("document insert conflicted and left no row");
  return { ok: true, id: existing.id };
}

export async function listDocuments(personId: string): Promise<StoredDocument[]> {
  const rows = await db
    .select()
    .from(documents)
    .where(and(eq(documents.personId, personId), isNull(documents.revokedAt)))
    .orderBy(desc(documents.createdAt))
    .limit(50);
  return rows.flatMap((row) => {
    const name = openName(row.nameEnc);
    if (name === null) return [];
    return [
      {
        id: row.id,
        name,
        blobId: row.blobId,
        sealId: row.sealId,
        accountId: row.accountId,
        mediaType: row.mediaType,
        byteSize: row.byteSize,
        createdAt: row.createdAt.toISOString(),
      },
    ];
  });
}

/** The file a turn asks about, if it is this person's and not revoked. */
export async function documentForTurn(
  personId: string,
  documentId: string,
): Promise<{ id: string; name: string } | null> {
  const [row] = await db
    .select({ id: documents.id, nameEnc: documents.nameEnc })
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.personId, personId),
        isNull(documents.revokedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  const name = openName(row.nameEnc);
  return name === null ? null : { id: row.id, name };
}

export async function attachDocument(messageId: string, documentId: string): Promise<void> {
  await db.insert(messageAttachments).values({ messageId, documentId }).onConflictDoNothing();
}
