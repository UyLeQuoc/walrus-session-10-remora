import { describe, expect, it } from "vitest";
import { signInitData, verifyInitData } from "./tg-init-data.ts";

const TOKEN = "123456:TEST-bot-token";
const NOW = Date.UTC(2026, 10, 5, 3);
const fields = (authDate = NOW / 1000) => ({
  auth_date: String(authDate),
  query_id: "AAH",
  user: JSON.stringify({ id: 42, first_name: "Uy", username: "uy" }),
});

describe("Telegram Mini App launch data (H3, ADR-0115)", () => {
  it("accepts what the bot's token signed, and names the Telegram user", () => {
    expect(verifyInitData(signInitData(fields(), TOKEN), TOKEN, { now: NOW })).toEqual({
      id: "42",
      name: "uy",
      authDate: NOW / 1000,
    });
  });

  it("refuses launch data older than a day", () => {
    const old = signInitData(fields(NOW / 1000 - 86_401), TOKEN);
    expect(verifyInitData(old, TOKEN, { now: NOW })).toBeNull();
  });

  it("refuses tampered data, another bot's signature, and no hash", () => {
    const good = signInitData(fields(), TOKEN);
    const tampered = good.replace("%22id%22%3A42", "%22id%22%3A43");
    expect(tampered).not.toBe(good);
    expect(verifyInitData(tampered, TOKEN, { now: NOW })).toBeNull();
    expect(verifyInitData(good, "999:another-bot", { now: NOW })).toBeNull();
    expect(
      verifyInitData(new URLSearchParams(fields()).toString(), TOKEN, { now: NOW }),
    ).toBeNull();
  });
});
