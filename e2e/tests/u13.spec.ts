/**
 * U13 (ADR-0069): every route in openbot's UI, signed in as the burner, at desktop (1280) and phone
 * (375) widths, light and dark. Each shot also asserts there is no horizontal scroll.
 *
 * `U13_ROUTES=/,/funds` limits the routes, `U13_WIDTHS=1280` the widths and `U13_THEMES=dark` the
 * themes, for a quick look while porting. The full run writes `screenshots/u13-<name>-<width>-<theme>.png`.
 */
import { expect, type Page, test } from "@playwright/test";
import { burner } from "../support/env";
import { connectAndSignIn, installTestWallet } from "../support/test-wallet";

type Route = { path: string; name: string; ready?: (page: Page) => Promise<unknown> };

const ROUTES: Route[] = [
  { path: "/", name: "home" },
  { path: "/chat", name: "chat" },
  { path: "/remoras", name: "remoras" },
  { path: "/remoras/new", name: "remoras-new" },
  { path: "/approvals", name: "approvals" },
  { path: "/funds", name: "funds" },
  { path: "/memory", name: "memory" },
  { path: "/connections", name: "connections" },
  { path: "/settings", name: "settings" },
  { path: "/hatchery", name: "hatchery" },
  { path: "/remoras/import", name: "import" },
  { path: "/verify", name: "verify" },
  { path: "/guide", name: "guide" },
  { path: "/playground", name: "playground" },
  { path: "/onboarding", name: "onboarding" },
  { path: "/lab", name: "lab" },
  { path: "/no-such-page", name: "not-found" },
];

const only = (key: string) =>
  process.env[key]
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(400);
}

/** The first remora, room and chat the burner owns, so their pages are in the set. */
async function ownedRoutes(page: Page): Promise<Route[]> {
  const out: Route[] = [];
  const remoras = await page.evaluate(async () => {
    const res = await fetch("/api/remoras", { credentials: "include" });
    return res.ok
      ? ((await res.json()) as { remoras: Array<{ id: string; status: string }> })
      : null;
  });
  const live = remoras?.remoras.find((r) => r.status !== "retired");
  if (live) {
    out.push({ path: `/remoras/${live.id}`, name: "remora" });
    out.push({ path: `/remoras/${live.id}?tab=learning`, name: "remora-learning" });
    out.push({ path: `/chat/r/${live.id}`, name: "thread" });
    out.push({ path: `/remoras/${live.id}/share`, name: "share" });
  }
  const rooms = await page.evaluate(async () => {
    const res = await fetch("/api/rooms", { credentials: "include" });
    return res.ok ? ((await res.json()) as { rooms: Array<{ id: string }> }) : null;
  });
  const room = rooms?.rooms[0];
  if (room) out.push({ path: `/chat/room/${room.id}`, name: "room" });
  return out;
}

test("U13: every route in openbot's UI, desktop and 375 px, light and dark", async ({ page }) => {
  test.setTimeout(30 * 60_000);
  const kp = burner();
  await installTestWallet(page, kp);
  await page.goto("/");
  await connectAndSignIn(page);
  await settle(page);

  const routes = [...ROUTES, ...(await ownedRoutes(page))];
  const pick = only("U13_ROUTES");
  const widths = (only("U13_WIDTHS") ?? ["1280", "375"]).map(Number);
  const themes = (only("U13_THEMES") ?? ["light", "dark"]) as Array<"light" | "dark">;

  for (const route of routes.filter(
    (r) => !pick || pick.includes(r.path) || pick.includes(r.name),
  )) {
    for (const width of widths) {
      for (const theme of themes) {
        await page.setViewportSize({ width, height: width < 500 ? 812 : 900 });
        await page.evaluate((t) => localStorage.setItem("remora.theme", t), theme);
        await page.goto(route.path);
        await settle(page);
        await route.ready?.(page);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(
          overflow,
          `${route.path} at ${width}px has no horizontal scroll`,
        ).toBeLessThanOrEqual(1);
        await page.screenshot({ path: `screenshots/u13-${route.name}-${width}-${theme}.png` });
      }
    }
  }
});
