/** Wires the playground (H7, ADR-0051) to the real env: the funder, its signer and balances, memory. */
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import type { SuiNetwork } from "@remora/chain";
import { env } from "../env/load.ts";
import { networks } from "../money/index.ts";
import { remoraService, runtime } from "../runtime/index.ts";
import type { JobHandler } from "../runtime/jobs.ts";
import { createRemoraMemory } from "../runtime/memory.ts";
import { createPlaygroundRoutes } from "./routes.ts";
import { expire, noMemory, PLAYGROUND_EXPIRE, type PlaygroundDeps } from "./service.ts";

// Testnet only until the mainnet pass decides otherwise (ADR-0051).
const NETWORK: SuiNetwork = "testnet";

const funder = env.PLAYGROUND_FUNDER_KEY
  ? Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(env.PLAYGROUND_FUNDER_KEY).secretKey)
  : null;

const memory =
  env.PLAYGROUND_MEMWAL_ACCOUNT_ID && env.PLAYGROUND_MEMWAL_PRIVATE_KEY
    ? createRemoraMemory(
        {
          key: env.PLAYGROUND_MEMWAL_PRIVATE_KEY,
          accountId: env.PLAYGROUND_MEMWAL_ACCOUNT_ID,
          serverUrl: env.MEMWAL_SERVER_URL,
        },
        runtime.log.child({ playground: true }),
      )
    : noMemory;

export const playgroundDeps: PlaygroundDeps = {
  runtime,
  service: remoraService,
  network: NETWORK,
  funder,
  limits: {
    questionsPerSession: env.PLAYGROUND_QUESTIONS,
    sessionsPerIpPerDay: env.PLAYGROUND_SESSIONS_PER_IP,
    pool: env.PLAYGROUND_POOL,
    ttlMinutes: env.PLAYGROUND_TTL_MINUTES,
    discUsdc: "1.00",
  },
  secret: env.SESSION_SECRET,
  memory,
  async sign(json) {
    if (!funder) throw new Error("no playground funder");
    const client = networks.client(NETWORK);
    const r = await client.signAndExecuteTransaction({
      transaction: Transaction.from(json),
      signer: funder,
      include: { effects: true },
    });
    const done = r.Transaction ?? r.FailedTransaction;
    if (!done.effects?.status.success)
      throw new Error(
        `playground transaction failed: ${JSON.stringify(done.effects?.status.error)}`,
      );
    await client.core.waitForTransaction({ digest: done.digest });
    return done.digest;
  },
  async balances() {
    if (!funder) return { usdc: 0n, sui: 0n };
    const core = networks.client(NETWORK).core;
    const owner = funder.toSuiAddress();
    const coinType = networks.config(NETWORK).usdcCoinType;
    const amount = (b: unknown) => BigInt((b as { balance: { balance: string } }).balance.balance);
    const [usdc, sui] = await Promise.all([
      core.getBalance({ owner, coinType }),
      core.getBalance({ owner }),
    ]);
    return { usdc: amount(usdc), sui: amount(sui) };
  },
};

export const playgroundRoutes = createPlaygroundRoutes(() => playgroundDeps);

export const playgroundJobs: Record<string, JobHandler> = {
  [PLAYGROUND_EXPIRE]: async (payload) => {
    await expire(playgroundDeps, String((payload as { sessionId?: string }).sessionId ?? ""));
  },
};
