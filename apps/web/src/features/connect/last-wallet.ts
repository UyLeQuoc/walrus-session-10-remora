/** The key dapp-kit persists when no `storageKey` is passed to `WalletProvider`. */
export const WALLET_CONNECTION_KEY = "sui-dapp-kit:wallet-connection-info";

export interface LastWallet {
  name: string;
  address: string;
}

/** The last wallet dapp-kit connected, so a later page can resume it without a chooser. */
export function lastWalletConnection(raw: string | null): LastWallet | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const state = (parsed as { state?: unknown }).state;
  if (!state || typeof state !== "object") return null;
  const name = (state as { lastConnectedWalletName?: unknown }).lastConnectedWalletName;
  const address = (state as { lastConnectedAccountAddress?: unknown }).lastConnectedAccountAddress;
  if (typeof name !== "string" || name.length === 0) return null;
  if (typeof address !== "string" || !address.startsWith("0x")) return null;
  return { name, address };
}
