/**
 * E2E (K6·e2e). Locally it starts the real server (8797) and the web app (5183) — never 8787/5173,
 * which another project uses — and runs:
 * - smoke (desktop + mobile): every W1 page paints;
 * - testnet: the burner wallet signs in, switches to testnet, detects and moves funds, and pauses
 *   and resumes its Discs.
 * `bun run e2e:main` runs smoke against a deployment (`E2E_BASE_URL`).
 */
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "@remora/memory";

loadEnv();

const root = resolve(import.meta.dirname, "..");
const remote = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  workers: 1,
  globalSetup: "./global-setup.ts",
  reporter: [["list"], ["html", { open: "never", outputFolder: "./playwright-report" }]],
  use: {
    baseURL: remote ?? "http://localhost:5183",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "smoke", testMatch: /smoke\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", testMatch: /smoke\.spec\.ts/, use: { ...devices["Pixel 7"] } },
    { name: "testnet", testMatch: /testnet\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: remote
    ? undefined
    : [
        {
          command: "npx tsx src/index.ts",
          cwd: `${root}/apps/server`,
          port: 8797,
          timeout: 120_000,
          reuseExistingServer: false,
          env: {
            PORT: "8797",
            CHANNELS: "off",
            WORKER: "off",
            INDEXER: "off",
            // The server boots only with an operator MemWal account; memory isn't under test here.
            MEMWAL_ACCOUNT_ID: process.env.MEMWAL_ACCOUNT_ID || `0x${"0".repeat(63)}1`,
          },
        },
        {
          command: "npx vite --port 5183 --strictPort",
          cwd: `${root}/apps/web`,
          port: 5183,
          timeout: 120_000,
          reuseExistingServer: false,
          env: { WEB_PORT: "5183", REMORA_API_URL: "http://localhost:8797" },
        },
      ],
});
