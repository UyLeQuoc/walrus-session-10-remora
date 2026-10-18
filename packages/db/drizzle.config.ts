import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

export default defineConfig({
  schema: "./src/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://hippo:hippo@localhost:5433/hippo" },
});
