export const FILE_LIMIT_BYTES = 100 * 1024;
export const STORAGE_EPOCHS = 14;
/** Two wallet transactions plus the upload relay's tip, with room to spare. */
export const MIN_SUI_MIST = 20_000_000n;

export type FileKind = "text/plain" | "text/markdown";

export function fileKind(name: string): FileKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";
  return null;
}

export function fileRefusal(file: { name: string; size: number }): string | null {
  if (!fileKind(file.name)) return "hippo reads .txt and .md files for now. Pick one of those.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > FILE_LIMIT_BYTES) return "That file is over 100 KB. Pick a smaller one.";
  return null;
}

export function ownerRefusal(input: {
  owned: boolean;
  ownerWallet: string | null;
  connected: string | null;
}): string | null {
  if (!input.owned || !input.ownerWallet) {
    return "Private files need a memory you own. Run /connect first; the file is then encrypted to your own account.";
  }
  if (!input.connected) return "Connect the wallet that owns your memory to keep private files.";
  if (input.connected.toLowerCase() !== input.ownerWallet.toLowerCase()) {
    return "Connect the wallet that owns your memory. Another wallet cannot open these files.";
  }
  return null;
}

/** Said before any signature is asked for, so a wallet is never asked to sign what it cannot pay. */
export function fundsRefusal(input: {
  sui: bigint;
  wal: bigint;
  walNeeded: bigint;
}): string | null {
  if (input.sui < MIN_SUI_MIST) {
    return "Your wallet needs about 0.02 SUI for the two transactions. Nothing was signed.";
  }
  if (input.wal < input.walNeeded) {
    return "Your wallet does not have enough WAL to pay Walrus for storage. Nothing was signed.";
  }
  return null;
}
