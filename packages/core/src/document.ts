export interface AttachedDocument {
  name: string;
  text: string;
}

export const DOCUMENT_TEXT_LIMIT = 100 * 1024;
const NAME_LIMIT = 120;

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The file the person attached, as untrusted data behind a per-request nonce,
 * with numbered lines so an answer can say where it came from. The name is
 * JSON-quoted and capped because the person chose it, and a file name is as
 * able to carry instructions as the file is.
 */
export function formatUntrustedDocument(doc: AttachedDocument, nonce = randomNonce()): string {
  if (!/^[0-9a-f]{32}$/.test(nonce)) throw new Error("nonce must be 16-byte lowercase hex");
  const lines = doc.text.slice(0, DOCUMENT_TEXT_LIMIT).split(/\r?\n/);
  const numbered = lines.map((line, index) => `${index + 1}| ${line}`);
  return [
    `Boundary nonce: ${nonce}`,
    `BEGIN_UNTRUSTED_FILE_${nonce}`,
    `name: ${JSON.stringify(doc.name.slice(0, NAME_LIMIT))}`,
    ...numbered,
    `END_UNTRUSTED_FILE_${nonce}`,
  ].join("\n");
}
