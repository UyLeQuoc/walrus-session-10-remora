/**
 * Testnet preconditions for the flow: the burner owns at least one Disc (so the Disc panel and the
 * panic button have something to act on) and holds some USDC in coins (so "Move" has work to do).
 */
import { buildIssue, type DiscConfig, getFundsSplit, listOwnerDiscs } from "@remora/disc-sdk";
import { DEPLOYMENTS } from "@remora/schema";
import { burner, testnet } from "./support/env";

export default async function globalSetup() {
  if (process.env.E2E_BASE_URL) return; // smoke-only against a deployment
  const kp = burner();
  const owner = kp.toSuiAddress();
  const client = testnet();
  const d = DEPLOYMENTS.testnet;
  if (!d.remoraPackageId || !d.discRegistryId) throw new Error("testnet Disc not published");
  const cfg: DiscConfig = {
    packageId: d.remoraPackageId,
    registryId: d.discRegistryId,
    coinType: d.usdcCoinType,
  };

  const discs = await listOwnerDiscs(client.core, cfg, owner);
  if (!discs.length) {
    const tx = buildIssue(cfg, {
      name: "e2e-burner",
      spender: `0x${"e2".repeat(32)}`,
      lifetimeCap: 100_000n,
      expiryMs: Date.now() + 30 * 24 * 3600_000,
      payees: [`0x${"3e".repeat(32)}`],
      perPaymentCap: 10_000n,
    });
    const r = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: kp,
      include: { effects: true },
    });
    const done = r.Transaction ?? r.FailedTransaction;
    if (!done.effects?.status.success) throw new Error("couldn't issue the burner's Disc");
    await client.core.waitForTransaction({ digest: done.digest });
    console.log(`[e2e] issued the burner's Disc: ${done.digest}`);
  }
  const funds = await getFundsSplit(client.core, owner, cfg.coinType);
  console.log(
    `[e2e] burner ${owner}: ${funds.coinBalance} USDC in coins, ${funds.addressBalance} in the address balance`,
  );
}
