import type { Memory } from "@/features/me/memory";

export type ReadResult =
  | { blobId: string; type: string; createdAt: string; text: string; verified: boolean }
  | { blobId: string; type: string; createdAt: string; error: string };

/**
 * Only memory sealed to the person's own account opens with their wallet.
 * What they said as a guest is in hippo's account, and saying it was read by
 * their wallet would be the one claim this page must never make falsely.
 */
export function readableRows(memories: Memory[], accountId: string | null | undefined): Memory[] {
  if (!accountId) return [];
  const own = accountId.toLowerCase();
  return memories.filter(
    (m) =>
      m.status === "stored" &&
      Boolean(m.blobId) &&
      m.accountId?.toLowerCase() === own &&
      !m.type.startsWith("team"),
  );
}

export function walletReadRefusal(input: {
  owned: boolean;
  ownerWallet: string | null;
  connected: string | null;
}): string | null {
  if (!input.owned || !input.ownerWallet) {
    return "Only memory in an account you own can be read with your wallet. Run /connect first.";
  }
  if (!input.connected) return "Connect the wallet that owns this memory to read it yourself.";
  if (input.connected.toLowerCase() !== input.ownerWallet.toLowerCase()) {
    return "That wallet does not own this memory. Connect the one that does.";
  }
  return null;
}

export async function sha256Text(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function readMarkdown(results: ReadResult[], account: string, readAt: string): string {
  const lines = [
    "# My hippo memory, read with my own wallet",
    "",
    `Account: ${account}`,
    `Read: ${readAt}, from Walrus, decrypted in the browser with Seal. The relayer took no part.`,
    "",
  ];
  for (const r of results) {
    if ("text" in r) {
      lines.push(
        `- ${r.text}${r.verified ? "" : " (does not match the hash hippo recorded when it wrote this)"}`,
      );
      lines.push(`  - blob ${r.blobId}`);
    } else {
      lines.push(`- (${r.type}, ${r.createdAt.slice(0, 10)}) could not be read: ${r.error}`);
      lines.push(`  - blob ${r.blobId}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
