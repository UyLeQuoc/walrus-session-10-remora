/**
 * E2E (K6·e2e). Locally it starts the real server (8797) and the web app (5183) — never 8787/5173,
 * which another project uses — and runs:
 * - smoke (desktop + mobile): every W1 page paints;
 * - testnet: the burner wallet signs in, switches to testnet, detects and moves funds, and pauses
 *   and resumes its Discs;
 * - w2: the W2 exit (U5 Phase C): first remora in under 3 minutes, Scout pays and answers with an
 *   anchored Wake, Sentinel learns a rule and applies it, and an over-limit payment is approved.
 * The facilitator + gas station (8798) and the demo merchants (8799) run locally as well.
 * `bun run e2e:main` runs smoke against a deployment (`E2E_BASE_URL`).
 */
import { resolve } from "node:path";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "@remora/memory";

loadEnv();

const root = resolve(import.meta.dirname, "..");
const remote = process.env.E2E_BASE_URL;
/** The demo merchants' testnet payTo: the W1 spike's spender (readable back), else a fixed address. */
const payTo =
  process.env.MERCHANT_PAYTO_TESTNET ||
  (process.env.SPIKE_SPENDER_KEY
    ? Ed25519Keypair.fromSecretKey(
        decodeSuiPrivateKey(process.env.SPIKE_SPENDER_KEY).secretKey,
      ).toSuiAddress()
    : `0x${"3e".repeat(32)}`);
/** W2 (U5 Phase C): the facilitator + gas station and the demo merchants run locally too. */
const FAC = "http://localhost:8798";
const MERCHANTS = "http://localhost:8799";

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
    { name: "w2", testMatch: /w2\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "u6", testMatch: /u6\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "u7", testMatch: /u7\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "u8", testMatch: /u8\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    // U12 (F14): agents through MCP. Claimed for U12 (docs/handoffs/2026-10-25-uy-to-huan-u12-claim.md).
    { name: "u12", testMatch: /u12\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "u13", testMatch: /u13\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    // The signed-in light/dark screenshot pass (plan §7.3). Opt in with AUDIT=1 so the default run
    // stays fast and only spends the burner when someone asks for the pictures.
    // The demo video's capture (ADR-0091): the real app, shot by shot. Opt in with DEMO=1; it spends
    // a few cents of testnet USDC (a playground session and one Scout answer).
    ...(process.env.DEMO === "1"
      ? [{ name: "demo", testMatch: /demo\.spec\.ts/, use: { ...devices["Desktop Chrome"] } }]
      : []),
    // ADR-0105: publish the curated templates and deprecate the test runs' (SEED=1), and run every
    // example the app suggests once on testnet (EXAMPLES=1; a few cents of testnet USDC).
    ...(process.env.SEED === "1"
      ? [{ name: "seed", testMatch: /seed\.spec\.ts/, use: { ...devices["Desktop Chrome"] } }]
      : []),
    ...(process.env.EXAMPLES === "1"
      ? [
          {
            name: "examples",
            testMatch: /examples\.spec\.ts/,
            use: { ...devices["Desktop Chrome"] },
          },
        ]
      : []),
    // U17 (ADR-0111): a remora buys another owner's remora's answer on testnet (ECONOMY=1; a few
    // cents of testnet USDC from the burner and the second test owner).
    ...(process.env.ECONOMY === "1"
      ? [{ name: "economy", testMatch: /economy\.spec\.ts/, use: { ...devices["Desktop Chrome"] } }]
      : []),
    // U18 (ADR-0119): the goal's exits on testnet (U18=1; spends well under 1 testnet USDC).
    ...(process.env.U18 === "1"
      ? [{ name: "u18", testMatch: /u18\.spec\.ts/, use: { ...devices["Desktop Chrome"] } }]
      : []),
    // U17: confirm the curated templates to a deployment's gallery (GALLERY=1, with E2E_BASE_URL).
    ...(process.env.GALLERY === "1"
      ? [
          {
            name: "gallery",
            testMatch: /gallery-confirm\.spec\.ts/,
            use: { ...devices["Desktop Chrome"] },
          },
        ]
      : []),
    // U14 (ADR-0103): the review capture, every route and state on a desktop and a phone, into
    // docs/ux/review/r<UX_ROUND>/. Opt in with UX=1; it reads and never pays.
    ...(process.env.UX === "1"
      ? [
          {
            name: "ux-desktop",
            testMatch: /audit\.spec\.ts/,
            use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
          },
          {
            name: "ux-phone",
            testMatch: /audit\.spec\.ts/,
            use: { ...devices["Pixel 7"], deviceScaleFactor: 2 },
          },
        ]
      : []),
    ...(process.env.AUDIT === "1"
      ? [
          {
            name: "audit",
            testMatch: /audit\.spec\.ts/,
            use: { ...devices["Desktop Chrome"] },
          },
        ]
      : []),
  ],
  webServer: remote
    ? undefined
    : [
        {
          command: "npx tsx src/index.ts",
          cwd: `${root}/apps/server`,
          stdout: "pipe",
          port: 8797,
          timeout: 120_000,
          reuseExistingServer: false,
          env: {
            PORT: "8797",
            CHANNELS: "off",
            // The W2 flow needs the worker (first run, Wake anchors) and the chain watcher (Sentinel).
            WORKER: "on",
            WATCHER: "on",
            INDEXER: "off",
            WEB_BASE_URL: "http://localhost:5183",
            // F14: where MCP clients reach /mcp (the web's proxy forwards only /api).
            API_BASE_URL: "http://localhost:8797",
            FACILITATOR_URL_TESTNET: FAC,
            MERCHANTS_URL_TESTNET: MERCHANTS,
            MERCHANT_PAYTO_TESTNET: payTo,
            // The server boots only with an operator MemWal account; memory isn't under test here.
            MEMWAL_ACCOUNT_ID: process.env.MEMWAL_ACCOUNT_ID || `0x${"0".repeat(63)}1`,
            // H7 (ADR-0051): the playground's funder is the burner (one test wallet, per Uy), with
            // small limits and a 3-minute session so the exit sees the onchain revoke.
            PLAYGROUND_FUNDER_KEY:
              process.env.PLAYGROUND_FUNDER_KEY || process.env.E2E_BURNER_KEY || "",
            PLAYGROUND_QUESTIONS: "2",
            PLAYGROUND_SESSIONS_PER_IP: "2",
            PLAYGROUND_POOL: "2",
            PLAYGROUND_TTL_MINUTES: "3",
          },
        },
        {
          command: "npx tsx src/main.ts",
          cwd: `${root}/apps/facilitator`,
          url: `${FAC}/supported`,
          stdout: "pipe",
          timeout: 120_000,
          reuseExistingServer: false,
          env: { FACILITATOR_PORT: "8798" },
        },
        {
          command: "npx tsx src/main.ts",
          cwd: `${root}/apps/merchants`,
          url: `${MERCHANTS}/health`,
          stdout: "pipe",
          timeout: 120_000,
          reuseExistingServer: false,
          env: {
            MERCHANTS_PORT: "8799",
            FACILITATOR_URL_TESTNET: FAC,
            MERCHANT_PAYTO_TESTNET: payTo,
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
