/**
 * G3 `remora verify <wake-id | tx-digest>`: checks a Wake against the chain through Tatum gRPC and
 * prints each check. A Wake that didn't pay shows its Merkle anchor (ADR-0139): "anchored in
 * <digest>, proof of N steps", with the proof and the `Anchored` event checked. Exit code 0 when
 * every check that can run passes, 1 otherwise.
 *
 *   bun run --filter @remora/server verify <ref>
 *
 * Needs DATABASE_URL (to find the Wake) and TATUM_API_KEY[_TESTNET] (to read the chain).
 */
import { createDb } from "@remora/db";
import { loadEnv } from "@remora/memory";
import { createNetworks } from "../src/money/networks.ts";
import { anchorLine, verifyWake } from "../src/runtime/verify.ts";

loadEnv();
const ref = process.argv[2];
if (!ref || !process.env.DATABASE_URL) {
  console.error("usage: verify <wake-id | tx-digest>   (needs DATABASE_URL)");
  process.exit(2);
}
const db = createDb(process.env.DATABASE_URL);
const networks = createNetworks(process.env);
const res = await verifyWake({ db, networks }, ref);
if (!res.found) {
  console.error(`No Wake with id or digest ${ref}.`);
  process.exit(1);
}
const mark = (ok: boolean | null) => (ok === null ? "–" : ok ? "✓" : "✗");
// ADR-0139: a Wake that didn't pay is anchored by its Merkle batch; a payment by its `Paid` event.
const where = res.anchor ? anchorLine(res.anchor) : res.anchored ? "anchored" : "not anchored yet";
console.log(`Wake ${res.receiptId} · ${res.wake.intent.decision.action} · ${where}`);
for (const c of res.checks) console.log(`${mark(c.ok)} ${c.name.padEnd(24)} ${c.detail}`);
process.exit(res.checks.some((c) => c.ok === false) ? 1 : 0);
