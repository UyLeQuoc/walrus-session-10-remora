import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export { and, desc, eq, gt, isNotNull, isNull, or, sql } from "drizzle-orm";
export * from "./schema.ts";

export type Db = ReturnType<typeof createDb>;

export function createDb(url: string) {
  const client = postgres(url, { max: 10, prepare: false });
  return drizzle(client, { schema });
}
