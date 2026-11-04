/**
 * ADR-0106 `wallet`: an X-ray of a Sui address over Sui gRPC: what it holds (each coin with its own
 * decimals), how many objects it owns, and the kinds it owns most. Read before the payment
 * (`sourceFirst`), so a node that doesn't answer costs nothing.
 */
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import type { SuiNetworkName } from "@remora/disc-sdk";
import {
  type PaidContext,
  SourceInputError,
  sourceFirst,
  type X402Options,
  x402,
} from "@remora/merchant";
import { Hono } from "hono";

export interface WalletXray {
  source: "Sui gRPC";
  network: SuiNetworkName;
  address: string;
  coins: { symbol: string; amount: string; coinType: string }[];
  objects: { count: number; more: boolean; kinds: { kind: string; count: number }[] };
}

const PAGE = 50;

/** A coin amount in its own decimals: "1.5", not "1500000000". */
export function formatUnits(raw: string, decimals: number): string {
  const n = BigInt(raw);
  if (!decimals) return n.toString();
  const base = 10n ** BigInt(decimals);
  const frac = (n % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${n / base}.${frac}` : (n / base).toString();
}

/** The last part of a type, without generics: `0x2::coin::Coin<…>` → `Coin`. */
export const kindOf = (type: string) => type.replace(/<.*$/, "").split("::").pop() ?? type;

const cache = new Map<string, { at: number; value: WalletXray }>();

/** The X-ray, tried once more after a failed read (public nodes drop the odd connection), cached a minute. */
export async function xray(
  client: SuiGrpcClient,
  network: SuiNetworkName,
  address: string,
  now = Date.now(),
): Promise<WalletXray> {
  const key = `${network}:${normalizeSuiAddress(address)}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < 60_000) return hit.value;
  const value = await readWallet(client, network, address).catch(async () => {
    await new Promise((r) => setTimeout(r, 400));
    return readWallet(client, network, address);
  });
  cache.set(key, { at: now, value });
  return value;
}

async function readWallet(
  client: SuiGrpcClient,
  network: SuiNetworkName,
  address: string,
): Promise<WalletXray> {
  const owner = normalizeSuiAddress(address);
  const { balances } = await client.core.listBalances({ owner });
  const coins = await Promise.all(
    balances
      .filter((b) => BigInt(b.balance) > 0n)
      .slice(0, 8)
      .map(async (b) => {
        const meta = await client.core
          .getCoinMetadata({ coinType: b.coinType })
          .then((m) => m.coinMetadata)
          .catch(() => null);
        return {
          symbol: meta?.symbol ?? kindOf(b.coinType),
          amount: meta ? formatUnits(b.balance, meta.decimals) : `${b.balance} base units`,
          coinType: b.coinType,
        };
      }),
  );
  const owned = await client.core.listOwnedObjects({ owner, limit: PAGE });
  const kinds = new Map<string, number>();
  for (const o of owned.objects) kinds.set(kindOf(o.type), (kinds.get(kindOf(o.type)) ?? 0) + 1);
  return {
    source: "Sui gRPC",
    network,
    address: owner,
    coins,
    objects: {
      count: owned.objects.length,
      more: owned.hasNextPage,
      kinds: [...kinds]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([kind, count]) => ({ kind, count })),
    },
  };
}

export function createWalletApp(o: {
  pay: X402Options;
  clients: Partial<Record<SuiNetworkName, SuiGrpcClient>>;
}) {
  const app = new Hono<{ Variables: { x402: PaidContext; source: WalletXray } }>();
  const only = Object.keys(o.clients) as SuiNetworkName[];
  app.get(
    "/wallet/:address",
    sourceFirst(
      async (c, network) => {
        const client = network ? o.clients[network] : undefined;
        if (!client || !network)
          throw new SourceInputError("network.unavailable", `No ${network} node here.`);
        return xray(client, network, c.req.param("address") ?? "");
      },
      (c) => {
        if (!/^0x[0-9a-fA-F]{1,64}$/.test(c.req.param("address") ?? ""))
          throw new SourceInputError("bad_address", "Give a Sui address, 0x…");
      },
      // With one network served, it reads the wallet before the buyer asks for gas, too.
      { early: only.length === 1 ? only[0] : false },
    ),
    x402(o.pay),
    (c) => c.json({ ...c.get("source"), paid: c.get("x402") }),
  );
  return app;
}
