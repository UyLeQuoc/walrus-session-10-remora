// M6 (ADR-0047): publishes `packages/move/hatchery` on TESTNET with the spike owner key, which keeps the
// UpgradeCap like the Disc's (ADR-0025). Writes the IDs to `.state.hatchery.testnet.json` (gitignored)
// for packages/schema DEPLOYMENTS.
//   bun --env-file=.env spikes/disc/hatchery-publish.ts
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { createTatumSuiClient, tatumSuiOptionsFromEnv } from "@remora/chain";

const here = dirname(fileURLToPath(import.meta.url));
const raw = process.env.SPIKE_OWNER_KEY;
if (!raw) throw new Error("SPIKE_OWNER_KEY is not set");
const owner = Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(raw).secretKey);
const client = createTatumSuiClient(tatumSuiOptionsFromEnv("testnet"));

const out = execFileSync("sui", ["move", "build", "--dump-bytecode-as-base64", "-e", "testnet"], {
  cwd: join(here, "../../packages/move/hatchery"),
  encoding: "utf8",
});
const { modules, dependencies } = JSON.parse(out.slice(out.indexOf("{")));
const tx = new Transaction();
tx.setSender(owner.toSuiAddress());
tx.transferObjects([tx.publish({ modules, dependencies })], owner.toSuiAddress());
const bytes = await tx.build({ client });
const { signature } = await owner.signTransaction(bytes);
const res = await client.core.executeTransaction({
  transaction: bytes,
  signatures: [signature],
  include: { effects: true, objectTypes: true },
});
const done = res.Transaction ?? res.FailedTransaction;
if (!done.effects?.status.success) throw new Error(JSON.stringify(done.effects?.status.error));
await client.core.waitForTransaction({ digest: done.digest });

const createdOf = (suffix: string) =>
  done.effects?.changedObjects.find(
    (o) => o.idOperation === "Created" && done.objectTypes?.[o.objectId]?.endsWith(suffix),
  )?.objectId;
const state = {
  packageId: done.effects.changedObjects.find((o) => o.outputState === "PackageWrite")?.objectId,
  registryId: createdOf("::hatchery::Registry"),
  upgradeCapId: createdOf("::package::UpgradeCap"),
  publishDigest: done.digest,
};
writeFileSync(join(here, ".state.hatchery.testnet.json"), `${JSON.stringify(state, null, 2)}\n`);
console.log(state);
process.exit(0);
