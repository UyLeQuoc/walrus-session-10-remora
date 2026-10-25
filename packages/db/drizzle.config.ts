import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

export default defineConfig({
  schema: [
    "./src/schema/identity.ts",
    "./src/schema/memory.ts",
    "./src/schema/runtime.ts",
    "./src/schema/money.ts",
    "./src/schema/hatchery.ts",
    "./src/schema/mcp.ts",
  ],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://remora:remora@localhost:5434/remora",
  },
});
