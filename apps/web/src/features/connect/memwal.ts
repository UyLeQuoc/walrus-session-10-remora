/** Move calls against the Walrus Memory account contract. */
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64, fromHex, normalizeSuiAddress, toHex } from "@mysten/sui/utils";

const SUI_CLOCK = "0x0000000000000000000000000000000000000000000000000000000000000006";

export interface SuiReadClient {
  core: {
    getObject(input: { objectId: string; include: { json: boolean } }): Promise<unknown>;
    getDynamicField(input: {
      parentId: string;
      name: { type: string; bcs: Uint8Array };
    }): Promise<unknown>;
  };
}

export interface ChainConfig {
  network: "mainnet" | "testnet";
  relayerUrl: string;
  packageId: string;
  registryId: string;
  /** hippo's own account, where guest memories live until a wallet is connected. */
  operatorAccountId?: string;
}

export function createAccountTx(cfg: ChainConfig): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${cfg.packageId}::account::create_account`,
    arguments: [tx.object(cfg.registryId), tx.object(SUI_CLOCK)],
  });
  return tx;
}

export function addDelegateKeyTx(
  cfg: ChainConfig,
  accountId: string,
  publicKeyHex: string,
  label: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${cfg.packageId}::account::add_delegate_key`,
    arguments: [
      tx.object(accountId),
      tx.object(cfg.registryId),
      tx.pure.vector("u8", Array.from(fromHex(publicKeyHex))),
      tx.pure.string(label),
      tx.object(SUI_CLOCK),
    ],
  });
  return tx;
}

export function removeDelegateKeyTx(
  cfg: ChainConfig,
  accountId: string,
  publicKeyHex: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${cfg.packageId}::account::remove_delegate_key`,
    arguments: [
      tx.object(accountId),
      tx.object(cfg.registryId),
      tx.pure.vector("u8", Array.from(fromHex(publicKeyHex))),
    ],
  });
  return tx;
}

/** One MemWalAccount per address, found through the registry's Table<address, ID>. */
export async function findAccountId(
  suiClient: SuiReadClient,
  registryId: string,
  owner: string,
): Promise<string | null> {
  const tableId = accountTableId(
    await suiClient.core.getObject({ objectId: registryId, include: { json: true } }),
  );
  if (!tableId) return null;
  const field = await suiClient.core
    .getDynamicField({
      parentId: tableId,
      name: { type: "address", bcs: fromHex(normalizeSuiAddress(owner)) },
    })
    .catch(() => null);
  const bytes = fieldBytes(field);
  if (bytes?.length !== 32) return null;
  if (!bytes) return null;
  return `0x${toHex(bytes)}`;
}

function accountTableId(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("object" in value)) return null;
  const object = value.object;
  if (typeof object !== "object" || object === null || !("json" in object)) return null;
  const json = object.json;
  if (typeof json !== "object" || json === null || !("accounts" in json)) return null;
  const accounts = json.accounts;
  if (typeof accounts !== "object" || accounts === null || !("id" in accounts)) return null;
  const id = accounts.id;
  if (typeof id === "string") return id;
  if (typeof id === "object" && id !== null && "id" in id && typeof id.id === "string")
    return id.id;
  return null;
}

function fieldBytes(value: unknown): Uint8Array | null {
  if (typeof value !== "object" || value === null || !("dynamicField" in value)) return null;
  const dynamicField = value.dynamicField;
  if (typeof dynamicField !== "object" || dynamicField === null || !("value" in dynamicField)) {
    return null;
  }
  const fieldValue = dynamicField.value;
  if (typeof fieldValue !== "object" || fieldValue === null || !("bcs" in fieldValue)) return null;
  const bcs = fieldValue.bcs;
  if (typeof bcs === "string") return fromBase64(bcs);
  if (bcs instanceof Uint8Array) return bcs;
  return null;
}
