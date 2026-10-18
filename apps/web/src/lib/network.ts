/**
 * A9·ui (ADR-0026): the session's Sui network. One deployment serves both networks; the choice is a
 * per-viewer convenience kept in localStorage, and `apiFetch` sends it as `x-remora-network`.
 */
import { useSyncExternalStore } from "react";

export type Network = "testnet" | "mainnet";
export const NETWORK_HEADER = "x-remora-network";
const KEY = "remora.network";

function read(): Network {
  try {
    const v = localStorage.getItem(KEY);
    return v === "mainnet" || v === "testnet" ? v : "testnet";
  } catch {
    return "testnet";
  }
}

let current: Network = read();
const listeners = new Set<() => void>();

export function currentNetwork(): Network {
  return current;
}

export function setNetwork(next: Network): void {
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Not remembered across reloads; the page still switches now.
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNetwork(): Network {
  return useSyncExternalStore(subscribe, currentNetwork, currentNetwork);
}

/** The Sui chain id wallets use for a network. */
export const chainOf = (n: Network) => `sui:${n}` as const;
