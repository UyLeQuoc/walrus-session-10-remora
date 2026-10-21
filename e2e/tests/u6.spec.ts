/**
 * The U6 exit on testnet (ADR-0042), with the burner as the owner (never a real owner):
 * 1. import a team from Markdown (Scout + Sentinel, a rule, a schedule) with ONE signature for every Disc;
 * 2. chat 1-1 with Scout: it pays, answers in the thread, the payment chip and Why? are inline;
 * 3. in the Team room, `@Sentinel` learns a rule and an un-mentioned odds question routes to Scout;
 * 4. Scout's over-cap request is an inline approval card; Pay once answers in the room;
 * 5. Scout's answer runs on the model chosen in the team file, and its Wake records the model used.
 * Timings and digests go to `test-results/u6-exit.json` for docs/spikes.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { expect, type Page, test } from "@playwright/test";
import { burner } from "../support/env";
import { connectAndSignIn, installTestWallet, WALLET_NAME } from "../support/test-wallet";

interface FeedEvent {
  id: string;
  type: string;
  summary: string;
  payload: Record<string, unknown>;
  receiptId: string | null;
}

const MODEL = "anthropic/claude-haiku-5.5";
const THREAD_QUESTION = "Is package 0x2 safe to depend on?";
const results: Record<string, unknown> = {};
const ms = (from: number) => Date.now() - from;

/** Same-origin API calls with the page's own session. */
const api = <T>(page: Page, path: string, method = "GET", body?: unknown): Promise<T> =>
  page.evaluate(
    async ([p, m, b]) => {
      const session = localStorage.getItem("remora.session");
      const res = await fetch(p as string, {
        method: m as string,
        credentials: "include",
        headers: {
          "x-remora-network": "testnet",
          ...(session ? { "x-remora-session": session } : {}),
          ...(b ? { "content-type": "application/json" } : {}),
        },
        ...(b ? { body: b as string } : {}),
      });
      return res.json();
    },
    [path, method, body === undefined ? "" : JSON.stringify(body)],
  ) as Promise<T>;

const feedOf = async (page: Page, remoraId: string) => {
  const body = await api<{ events?: FeedEvent[] }>(page, `/api/feed?remora=${remoraId}&limit=200`);
  if (!body.events) throw new Error(`feed: ${JSON.stringify(body)}`);
  return body.events;
};

/** The app resumes the last approved wallet silently; this is the fallback if that fails. */
async function goto(page: Page, path: string) {
  await page.goto(path);
  const reconnect = page.getByRole("button", { name: "Reconnect" });
  await reconnect.waitFor({ state: "visible", timeout: 8_000 }).catch(() => {});
  if (await reconnect.isVisible().catch(() => false)) {
    await reconnect.click({ timeout: 30_000 });
    await page.getByRole("button", { name: WALLET_NAME }).click();
  }
  await expect(reconnect).toBeHidden({ timeout: 30_000 });
}

const teamFile = (stamp: string, watched: string) => `---
schema: remora.team/v1
name: U6 desk ${stamp}
description: The U6 exit team.
remoras:
  - template: scout
    name: Scout ${stamp}
    model: ${MODEL}
    budget:
      monthlyUsd: 0.5
      perPaymentUsd: 0.015
    schedules:
      - when: weekdays at 8am
        question: Is package 0x2 safe to depend on?
  - template: sentinel
    name: Sentinel ${stamp}
    watch:
      - ${watched}
    rules:
      - Ignore incoming SUI under 0.01
room:
  name: Team
  responder: auto
  lead: Scout ${stamp}
---

# U6 desk
Ask Scout anything onchain; tell Sentinel what matters.
`;

test("U6 exit: team from Markdown, 1-1 chat, room routing, inline approval, model per remora", async ({
  page,
}) => {
  test.setTimeout(20 * 60_000);
  const kp = burner();
  const wallet = await installTestWallet(page, kp);
  results.owner = kp.toSuiAddress();
  const stamp = Date.now().toString(36);
  const watched = new Ed25519Keypair().toSuiAddress();

  // 1. Import the team: one signature for every Disc.
  const t0 = Date.now();
  await page.goto("/remoras/import");
  await connectAndSignIn(page);
  await page.getByLabel("Team file", { exact: true }).fill(teamFile(stamp, watched));
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByTestId("team-remora")).toHaveCount(2, { timeout: 30_000 });
  const signedBefore = wallet.signed.length;
  await page.getByRole("button", { name: /Create the team \(one signature\)/ }).click();
  await page.waitForURL(/\/chat\/room\/[0-9a-f-]{36}/, { timeout: 180_000 });
  results.importMs = ms(t0);
  results.importSignatures = wallet.signed.length - signedBefore;
  expect(results.importSignatures, "one signature for the whole team").toBe(1);
  const roomId = /\/chat\/room\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";
  results.roomId = roomId;
  const mine = (
    await api<{
      remoras: {
        id: string;
        name: string;
        template: string;
        discId: string | null;
        config: { model?: string };
      }[];
    }>(page, "/api/remoras")
  ).remoras;
  const scout = mine.find((r) => r.name === `Scout ${stamp}`);
  const sentinel = mine.find((r) => r.name === `Sentinel ${stamp}`);
  expect(scout?.discId, "Scout's Disc confirmed").toBeTruthy();
  expect(scout?.config.model).toBe(MODEL);
  const ready = (await feedOf(page, scout?.id ?? "")).find((e) => /Disc is live/.test(e.summary));
  results.teamIssue = ready?.payload.digest ?? null;
  await page.screenshot({ path: "screenshots/u6-room.png", fullPage: true });

  // Out of shadow mode, so Scout really pays.
  await api(page, `/api/remoras/${scout?.id}/activate`, "POST");

  // 2. 1-1 chat with Scout: payment chip, answer, Why?.
  await goto(page, `/chat/r/${scout?.id}`);
  const t1 = Date.now();
  await page.getByLabel("Message").fill(THREAD_QUESTION);
  await page.getByLabel("Message").press("Enter");
  await expect(
    page.locator('[data-testid="thread-chip"][data-type="payment"]').first(),
  ).toBeVisible({ timeout: 180_000 });
  await expect(page.getByTestId("typing")).toHaveCount(0, { timeout: 180_000 });
  results.threadMs = ms(t1);
  const scoutFeed = await feedOf(page, scout?.id ?? "");
  // Its first-run job buys sui-risk for the Disc package too; this is the thread's question about 0x2.
  const paid = scoutFeed.find(
    (e) => e.type === "payment" && String(e.payload.url).endsWith("/sui-risk/0x2"),
  );
  results.threadPayment = paid?.payload.digest ?? null;
  results.threadAnswer = String(
    scoutFeed.find((e) => e.type === "answer" && e.payload.question === THREAD_QUESTION)?.payload
      .answer ?? "",
  ).slice(0, 240);
  expect(results.threadPayment, "Scout paid sui-risk from the thread").toBeTruthy();
  await page
    .locator('[data-testid="thread-chip"][data-type="payment"]')
    .first()
    .getByRole("button", { name: "Why?" })
    .click();
  await expect(page.getByText(/anchored onchain|not anchored/).first()).toBeVisible({
    timeout: 30_000,
  });
  await page.screenshot({ path: "screenshots/u6-thread.png", fullPage: true });
  await page.keyboard.press("Escape");

  // 5. The Wake records the model that wrote the answer (or that none did).
  const answer = scoutFeed.find(
    (e) => e.type === "answer" && e.receiptId && e.payload.question === THREAD_QUESTION,
  );
  const why = await api<{ wake: { wake: { intent: { model: { id: string } } } } | null }>(
    page,
    `/api/events/${answer?.id}/why`,
  );
  results.answerModel = why.wake?.wake.intent.model.id ?? null;
  results.modelVerified = results.answerModel === MODEL;
  expect([MODEL, "remora/no-model"]).toContain(results.answerModel);

  // 3. The room: @Sentinel learns; an un-mentioned odds question routes to Scout.
  await goto(page, `/chat/room/${roomId}`);
  await page.getByLabel("Message").fill(`@Sentinel ${stamp} ignore outgoing SUI under 0.002`);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("route-label").last()).toContainText(`Sentinel ${stamp} · named`, {
    timeout: 60_000,
  });
  await expect(page.getByText(/Learned: ignore outgoing SUI under 0.002/).first()).toBeVisible({
    timeout: 60_000,
  });
  const t2 = Date.now();
  await page.getByLabel("Message").fill("What are the odds for tonight's match?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("route-label").last()).toContainText(`Scout ${stamp} · matched`, {
    timeout: 180_000,
  });
  results.routeMs = ms(t2);

  // 4. The inline approval card: Pay once, then the payment and answer follow in the room.
  const card = page.getByTestId("inline-approval").last();
  await expect(card).toBeVisible({ timeout: 180_000 });
  const t3 = Date.now();
  const chips = page.locator('[data-testid="thread-chip"][data-type="payment"]');
  const chipsBefore = await chips.count();
  await card.getByRole("button", { name: /Pay once \(0\.02 USDC\)/ }).click();
  await expect(card.getByText("Approved")).toBeVisible({ timeout: 180_000 });
  // The card turns Approved when the approval is decided; the payment and answer land a moment later.
  await expect
    .poll(
      async () => {
        const approved = (await feedOf(page, scout?.id ?? "")).find(
          (e) => e.type === "payment" && e.payload.approvedBy === "owner",
        );
        results.ownerPayment = approved?.payload.digest ?? null;
        return results.ownerPayment;
      },
      { message: "the owner's one-off payment settled", timeout: 120_000 },
    )
    .toBeTruthy();
  // The answer written from the bought data, under the card (not the turn's first reply). The Team
  // room outlives runs, so only lines from after the click count.
  await expect
    .poll(
      async () => {
        const paidAnswer = (
          await api<{
            messages: {
              eventType: string | null;
              payload: Record<string, unknown>;
              createdAt: string;
            }[];
          }>(page, `/api/rooms/${roomId}/messages`)
        ).messages.find(
          (l) => l.eventType === "answer" && l.payload.approvalId && Date.parse(l.createdAt) >= t3,
        );
        results.paidAnswer = paidAnswer ? String(paidAnswer.payload.answer) : null;
        return results.paidAnswer;
      },
      { message: "the paid answer follows in the room", timeout: 120_000 },
    )
    .toBeTruthy();
  results.approvalMs = ms(t3);
  // The room shows the payment under the card before the picture is taken.
  await expect.poll(() => chips.count(), { timeout: 30_000 }).toBeGreaterThan(chipsBefore);
  await page.screenshot({ path: "screenshots/u6-approval.png", fullPage: true });

  // Clean up: retire the Scout (owner signs the revoke), so runs don't pile up Discs on the burner.
  await goto(page, `/remoras/${scout?.id}`);
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Retire" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Retire" }).click();
  await expect(page.getByText("retired").first()).toBeVisible({ timeout: 90_000 });
  // The Sentinel has no Disc: retiring it needs no signature.
  await api(page, `/api/remoras/${sentinel?.id}/retire/confirm`, "POST", {});
  results.sentinelId = sentinel?.id;
  results.signatures = wallet.signed.length;
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/u6-exit.json", JSON.stringify(results, null, 2));
  console.log("[u6-exit]", JSON.stringify(results));
});
