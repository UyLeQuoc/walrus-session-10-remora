/** Everything a remora turn needs, injected so tests can swap the chain, the model and memory. */
import type { Transaction } from "@mysten/sui/transactions";
import type { Logger, SuiNetwork } from "@remora/chain";
import type { Db } from "@remora/db";
import type { RemoraSigner } from "@remora/signer";
import type { Networks } from "../money/networks.ts";
import type { ResolvedReef } from "../money/reef.ts";
import type { Brain } from "./brain.ts";
import type { FactLedger } from "./facts.ts";
import type { SlidingLimiter } from "./limits.ts";
import type { RemoraMemory } from "./memory.ts";
import type { Notifier } from "./notify.ts";

export interface RuntimeDeps {
  db: Db;
  networks: Networks;
  signer: RemoraSigner;
  log: Logger;
  reef: (network: SuiNetwork) => ResolvedReef[];
  memory: RemoraMemory;
  /** F15 (ADR-0074): the facts behind memory. Absent, admission still dedupes and caps recall. */
  facts?: FactLedger;
  /** F15: a model pass over admitted memories (off by default; `MEMORY_ADMISSION_JUDGE=on`). */
  admissionJudge?: boolean;
  brain: Brain;
  notifier: Notifier;
  limiter: SlidingLimiter;
  /** D9: tokens per remora per UTC day. */
  dailyTokens: number;
  /** The dashboard, for "Why?" and approval links in notifications. */
  webBase: string;
  /**
   * Test flag (W2 exit, Phase C): skip Sonar so the Disc alone has to stop an injected payment.
   * Never set in production; `/api` can't change it.
   */
  sonarOff?: boolean;
  fetch?: typeof fetch;
  buildKind?: (tx: Transaction) => Promise<Uint8Array>;
}
