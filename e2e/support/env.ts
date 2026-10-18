/** E2E env: the burner (testnet only, never a real owner) and a Tatum testnet client. */
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { createTatumSuiClient, tatumSuiOptionsFromEnv } from "@remora/chain";
import { loadEnv } from "@remora/memory";

loadEnv();

export function burner(): Ed25519Keypair {
  const raw = process.env.E2E_BURNER_KEY;
  if (!raw) throw new Error("E2E_BURNER_KEY is not set (a testnet burner; see docs/e2e/README.md)");
  return Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(raw).secretKey);
}

let client: ReturnType<typeof createTatumSuiClient> | null = null;
export function testnet() {
  client ??= createTatumSuiClient(tatumSuiOptionsFromEnv("testnet"));
  return client;
}
