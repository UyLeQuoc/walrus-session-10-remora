/**
 * Show exactly what `drizzle-kit push` would do to a database, and apply it
 * only when it is purely additive.
 *
 * `drizzle-kit push` applies whatever difference it computes, including DROP
 * statements if a database has drifted from the schema, and the production
 * database holds real users' encrypted delegate keys. Its interactive guard
 * cannot be answered from a non-interactive shell. This uses the same diff
 * through `pushSchema`, prints it, and applies only when asked and only if
 * every statement adds a column or a table and nothing reports data loss.
 *
 *   tsx scripts/plan-push.ts <env-file>            print the plan
 *   tsx scripts/plan-push.ts <env-file> --apply    apply it, if additive
 *
 * The URL is read from the env file and never printed; only its host is.
 */
import { resolve } from "node:path";
import { config } from "dotenv";
import { pushSchema } from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/schema.ts";
import { isAdditive } from "./additive.ts";

const [envFile, flag] = process.argv.slice(2);
if (!envFile) throw new Error("usage: plan-push.ts <env-file> [--apply]");
const parsed = config({ path: resolve(envFile), processEnv: {}, quiet: true }).parsed ?? {};
const url = parsed.DATABASE_URL;
if (!url) throw new Error(`no DATABASE_URL in ${envFile}`);

const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
const db = drizzle(client);
// pushSchema reads `result.rows`, the node-postgres shape. postgres-js returns
// a bare array, so without this the schema pull fails and drizzle-kit exits 1
// with the error swallowed by its spinner.
const execute = db.execute.bind(db);
(db as unknown as { execute: typeof execute }).execute = (async (
  query: Parameters<typeof execute>[0],
) => {
  const result = await execute(query);
  return Array.isArray(result) ? Object.assign(result, { rows: [...result] }) : result;
}) as unknown as typeof execute;
try {
  console.log(`database host: ${new URL(url).host}`);
  const plan = await pushSchema(schema, db as never);
  console.log(`statements: ${plan.statementsToExecute.length}, data loss: ${plan.hasDataLoss}`);
  for (const w of plan.warnings) console.log(`warning: ${w}`);
  for (const st of plan.statementsToExecute) console.log(`  ${st}`);

  const additive = isAdditive(plan.statementsToExecute);
  if (flag === "--apply") {
    if (plan.hasDataLoss || plan.warnings.length || !additive) {
      console.log("refusing to apply: the plan is not purely additive");
      process.exitCode = 1;
    } else if (!plan.statementsToExecute.length) {
      console.log("nothing to apply");
    } else {
      await plan.apply();
      console.log("applied");
    }
  } else {
    console.log(additive ? "plan is purely additive" : "plan is NOT purely additive");
  }
} finally {
  await client.end();
}
