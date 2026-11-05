/**
 * U19 live checks on a deployment (ADR-0134). Opt in with
 * `U19_LIVE=1 E2E_BASE_URL=https://getremora.vercel.app bun run --filter @remora/e2e e2e -- --project=u19live`.
 *
 * - A replay on production: the burner's Researcher plans its own past questions three ways
 *   (never pays, never writes memory).
 * - The x402 discovery catalog lists the live Reef.
 * - An auditor page: burner2 opens the auditor link the burner made and matches its receipts.
 *
 * What happened goes to `exit-results/u19-live.json` (gitignored), for the exit note.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { expect, type Page, test } from "@playwright/test";
import { burner } from "../support/env";
import { connectAndSignIn, installTestWallet } from "../support/test-wallet";

const OUT = "exit-results/u19-live.json";
mkdirSync("exit-results", { recursive: true });
const prior = (): Record<string, unknown> => {
  try {
    return JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    return {};
  }
};
const save = (patch: Record<string, unknown>) =>
  writeFileSync(
    OUT,
    JSON.stringify({ ...prior(), ...patch, at: new Date().toISOString() }, null, 2),
  );

export const api = <T>(page: Page, path: string, init: { method?: string; body?: unknown } = {}) =>
  page.evaluate(
    async ({ p, method, body }) => {
      const session = localStorage.getItem("remora.session");
      const res = await fetch(p, {
        method: method ?? "GET",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-remora-network": "testnet",
          ...(session ? { "x-remora-session": session } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return res.json();
    },
    { p: path, method: init.method, body: init.body },
  ) as Promise<T>;

export const burner2 = () => {
  const raw = process.env.E2E_BURNER2_KEY;
  if (!raw) throw new Error("E2E_BURNER2_KEY is not set");
  return Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(raw).secretKey);
};

test.describe.configure({ mode: "serial" });

test("U19 live: the x402 discovery catalog lists the live Reef", async ({ page }) => {
  expect(process.env.E2E_BASE_URL, "a deployment only").toBeTruthy();
  await page.goto("/");
  const catalog = await api<{
    x402Version: number;
    items: { resource: string; metadata: { ref: string; name: string; kind: string } }[];
    pagination: { total: number };
  }>(page, "/api/facilitator/discovery/resources?limit=100");
  expect(catalog.items.length).toBeGreaterThan(0);
  for (const i of catalog.items) expect(i.resource.startsWith("https://")).toBe(true);
  save({
    discovery: {
      total: catalog.pagination.total,
      items: catalog.items.map((i) => ({
        ref: i.metadata.ref,
        kind: i.metadata.kind,
        resource: i.resource,
      })),
    },
  });
});

test("U19 live: a replay on production plans past questions three ways and buys nothing", async ({
  page,
}) => {
  test.setTimeout(15 * 60_000);
  expect(process.env.E2E_BASE_URL, "a deployment only").toBeTruthy();
  await installTestWallet(page, burner());
  await page.goto("/remoras");
  await connectAndSignIn(page);
  const { remoras } = await api<{
    remoras: { id: string; name: string; status: string; template: string }[];
  }>(page, "/api/remoras");
  const r = remoras.find((x) => x.name === "Researcher · reef" && x.status === "active");
  expect(r, "U19 E2 made the burner's Researcher · reef").toBeTruthy();
  const home = await api<{ questions: { question: string }[]; defaultT0: string }>(
    page,
    `/api/remoras/${r?.id}/replay`,
  );
  const questions = home.questions.slice(0, 6).map((q) => q.question);
  expect(questions.length).toBeGreaterThan(0);
  const before = await api<{ events: unknown[] }>(page, `/api/feed?remora=${r?.id}&type=payment`);
  const { runId } = await api<{ runId: string }>(page, `/api/remoras/${r?.id}/replay`, {
    method: "POST",
    body: { questions },
  });
  expect(runId).toBeTruthy();
  type Run = { status: string; totals: Record<string, { services: number; spend: string }> };
  let run: Run | null = null;
  for (let i = 0; i < 60; i++) {
    run = await api<Run>(page, `/api/remoras/${r?.id}/replay/${runId}`);
    if (run.status !== "running") break;
    await page.waitForTimeout(5_000);
  }
  expect(run?.status).toBe("done");
  const after = await api<{ events: unknown[] }>(page, `/api/feed?remora=${r?.id}&type=payment`);
  expect(after.events.length, "a replay pays nothing").toBe(before.events.length);
  save({ replay: { remora: r?.id, runId, questions, totals: run?.totals } });
});
