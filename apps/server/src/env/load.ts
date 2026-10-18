import { loadEnv, withoutBlanks } from "@remora/memory";
import { serverEnvSchema } from "./schema.ts";

loadEnv();

const parsed = serverEnvSchema.safeParse(withoutBlanks(process.env));
if (!parsed.success) {
  console.error("Invalid environment:");
  for (const i of parsed.error.issues) console.error(`  ${i.path.join(".")}: ${i.message}`);
  process.exit(1);
}
export const env = parsed.data;
export type Env = typeof env;
