/**
 * Wires the remora runtime (W2) to the real env: B4 keys in Postgres, OpenRouter models per role
 * (D9), Walrus Memory through the operator account (ADR-0030), Telegram notices (H5), the Reef (E7),
 * the D2 job handlers and one chain watcher per network (D1). Tests use the factories directly.
 */
import type { SuiNetwork } from "@remora/chain";
import { createModel } from "@remora/core";
import {
  and,
  channelIdentities,
  count,
  eq,
  isNotNull,
  people,
  receipts,
  remoras,
  sentinelRules,
} from "@remora/db";
import { parseKek, RemoraSigner } from "@remora/signer";
import type { Context } from "hono";
import { sendNotice, telegramBot } from "../channels/telegram-bot.ts";
import { verifyInitData } from "../channels/tg-init-data.ts";
import { db, modelFor, operator } from "../context.ts";
import { env } from "../env/load.ts";
import { onIndexedEvents } from "../hatchery/service.ts";
import { createWalrusStore } from "../hatchery/walrus.ts";
import { createLinkCode } from "../identity/link.ts";
import { personByChannel } from "../identity/persons.ts";
import { signedInOwner } from "../identity/session.ts";
import { log, networks } from "../money/index.ts";
import { createListings } from "../money/listings.ts";
import { createSuiUsd } from "../money/rates.ts";
import { reefFor } from "../money/reef.ts";
import { startWatcher } from "../triggers/watch.ts";
import { createBrain } from "./brain.ts";
import type { RuntimeDeps } from "./deps.ts";
import { createFactLedger, withFacts } from "./facts.ts";
import { inspect } from "./inspector.ts";
import type { JobHandler } from "./jobs.ts";
import { PgKeyStore } from "./keys.ts";
import { addUsage, SlidingLimiter } from "./limits.ts";
import { createRemoraMemory } from "./memory.ts";
import { memoryIndexFor } from "./memory-controls.ts";
import { createNotifier } from "./notify.ts";
import { createRemoraService } from "./remoras.ts";
import { createRemoraRoutes } from "./routes.ts";
import { remoraJobHandlers } from "./schedules.ts";
import { onChainEvent } from "./sentinel.ts";

const signer = new RemoraSigner(new PgKeyStore(db), parseKek(env.KEY_ENCRYPTION_KEY));
const merchants = {
  MERCHANTS_URL: env.MERCHANTS_URL,
  MERCHANTS_URL_TESTNET: env.MERCHANTS_URL_TESTNET,
  MERCHANT_PAYTO: env.MERCHANT_PAYTO,
  MERCHANT_PAYTO_TESTNET: env.MERCHANT_PAYTO_TESTNET,
  // ADR-0110: the demo's attacker is listed only for a local capture; reefFor checks all three.
  DEMO_ATTACK: process.env.DEMO_ATTACK,
  RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
  NODE_ENV: process.env.NODE_ENV,
};
/** E11 (ADR-0111): remoras on sale, in the Reef beside the house services, paid at `/api/x402/r/…`. */
export const listings = createListings({
  db,
  base: env.API_BASE_URL ?? `http://localhost:${env.PORT}`,
  log,
});
const reef = (n: Parameters<typeof reefFor>[1]) => [
  ...reefFor(merchants, n),
  ...listings.entries(n),
];
const answer = createModel({ apiKey: env.OPENROUTER_API_KEY, model: env.LLM_MODEL });
const small = createModel({
  apiKey: env.OPENROUTER_API_KEY,
  // Sonar's check and rule parsing. Not the fallback model: qwen3.7-flash answers checks with
  // reasons too long for the schema and blocked a legitimate purchase (U6 spike, ADR-0045).
  model: env.LLM_SMALL_MODEL ?? env.LLM_MODEL,
});

const brain = createBrain({
  answer: answer.primary,
  answerId: answer.id,
  answerFor: (id) => modelFor(id).primary,
  check: small.primary,
  parse: small.primary,
  parseId: env.LLM_SMALL_MODEL ?? env.LLM_MODEL,
});

/** F15 (ADR-0074): the facts behind memory; extraction tokens count against the remora's daily cap. */
const facts = createFactLedger(db, {
  log,
  ...(env.MEMORY_FACTS === "on" && brain.extractFacts ? { extract: brain.extractFacts } : {}),
  onTokens: (r, tokens) => addUsage(db, r.id, tokens),
});

export const runtime: RuntimeDeps = {
  db,
  networks,
  signer,
  log,
  reef,
  memory: withFacts(createRemoraMemory(operator, log, memoryIndexFor(db)), facts),
  facts,
  admissionJudge: env.MEMORY_ADMISSION_JUDGE === "on",
  brain,
  notifier: createNotifier({
    db,
    ...(telegramBot
      ? {
          telegram: (chatId, n) =>
            sendNotice(telegramBot as NonNullable<typeof telegramBot>, chatId, n),
        }
      : {}),
  }),
  limiter: new SlidingLimiter(),
  dailyTokens: env.REMORA_DAILY_TOKENS,
  webBase: env.WEB_BASE_URL,
  suiUsd: createSuiUsd({ apiKey: env.TATUM_API_KEY ?? env.TATUM_API_KEY_TESTNET }),
};

export const remoraService = createRemoraService({ db, networks, signer, reef, log });

/** F6: what we wrote per namespace, from our own tables (Wakes → receipts, rules → rules). */
async function written(r: { id: string }) {
  const [w] = await db.select({ n: count() }).from(receipts).where(eq(receipts.remoraId, r.id));
  const [rl] = await db
    .select({ n: count() })
    .from(sentinelRules)
    .where(eq(sentinelRules.remoraId, r.id));
  return { receipts: Number(w?.n ?? 0), ...(rl?.n ? { rules: Number(rl.n) } : {}) };
}

const hatchery = {
  walrus: createWalrusStore(),
  webBase: env.WEB_BASE_URL,
  telegramBot: env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "") ?? null,
};

/** M4: templates published or hatched anywhere, from the checkpoint indexer. */
export const onHatcheryEvents = (
  network: SuiNetwork,
  events: Parameters<typeof onIndexedEvents>[2],
) => onIndexedEvents({ ...hatchery, runtime, service: remoraService }, network, events);

export const remoraRoutes = createRemoraRoutes({
  service: remoraService,
  runtime,
  owner: async (c: Context) => (await signedInOwner(c))?.owner ?? null,
  inspect: (r, namespaces) => inspect(operator, r, namespaces),
  operator,
  hatchery,
  written,
  listings,
  // H3 (ADR-0115): the Mini App's owner, from Telegram's signed launch data and the A5 link.
  tgOwner: async (initData: string) => {
    const user = env.TELEGRAM_BOT_TOKEN ? verifyInitData(initData, env.TELEGRAM_BOT_TOKEN) : null;
    if (!user) return null;
    return (await personByChannel("telegram", user.id))?.walletAddress ?? null;
  },
  telegramLinked: async (owner: string) => {
    const [row] = await db
      .select({ id: channelIdentities.id })
      .from(people)
      .innerJoin(channelIdentities, eq(channelIdentities.personId, people.id))
      .where(
        and(
          eq(people.walletAddress, owner.toLowerCase()),
          eq(channelIdentities.channel, "telegram"),
        ),
      )
      .limit(1);
    return !!row;
  },
  telegramLink: async (c: Context) => {
    if (!env.TELEGRAM_BOT_TOKEN) return null;
    const who = await signedInOwner(c);
    if (!who) return null;
    const { code, expiresInMinutes } = await createLinkCode(who.person);
    const url = env.TELEGRAM_BOT_USERNAME
      ? `https://t.me/${env.TELEGRAM_BOT_USERNAME.replace(/^@/, "")}?start=link_${code}`
      : null;
    return { code, url, expiresInMinutes };
  },
});

export const remoraJobs: Record<string, JobHandler> = remoraJobHandlers(runtime);

/** Starts one chain watcher per available network (D1). Returns a stop function. */
export function startRemoraRuntime(): () => void {
  const stopListings = listings.start();
  if (env.WATCHER !== "on") return stopListings;
  const stops = networks
    .list()
    .filter((n) => n.available)
    .map((n) =>
      startWatcher({
        network: n.network,
        client: networks.client(n.network),
        db,
        log,
        onEvent: async (remoraId, e, checkpoint) => {
          const [r] = await db
            .select()
            .from(remoras)
            .where(and(eq(remoras.id, remoraId), isNotNull(remoras.address)));
          if (r) await onChainEvent(runtime, r, e, checkpoint);
        },
      }),
    );
  log.info("remora.runtime", { watchers: stops.length });
  return () => {
    stopListings();
    for (const s of stops) s();
  };
}
