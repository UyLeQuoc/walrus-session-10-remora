import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnvText, withoutBlanks } from "@remora/memory";
import { describe, expect, it } from "vitest";
import { serverEnvSchema } from "./schema.ts";

// What README step one asks a judge to fill in; everything else stays as shipped.
const FILLED = {
  MEMWAL_ACCOUNT_ID: `0x${"d".repeat(64)}`,
  MEMWAL_PRIVATE_KEY: "a".repeat(64),
  OPENROUTER_API_KEY: "sk-or-test",
  SESSION_SECRET: "b".repeat(64),
  KEY_ENCRYPTION_KEY: "c".repeat(64),
};

const example = parseEnvText(
  readFileSync(resolve(import.meta.dirname, "../../../../.env.example"), "utf8"),
);

describe("a freshly copied .env.example", () => {
  it("starts the server once the operator values and secrets are filled", () => {
    // A fresh clone refused to start: `SURVEY_URL=` is "", not an optional URL.
    const parsed = serverEnvSchema.safeParse(withoutBlanks({ ...example, ...FILLED }));
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.data?.SURVEY_URL).toBeUndefined();
    expect(parsed.data?.TELEGRAM_BOT_TOKEN).toBeUndefined();
  });

  it("still names what is missing when a secret is left blank", () => {
    const parsed = serverEnvSchema.safeParse(
      withoutBlanks({ ...example, ...FILLED, OPENROUTER_API_KEY: "" }),
    );
    expect(parsed.error?.issues.map((i) => i.path.join("."))).toEqual(["OPENROUTER_API_KEY"]);
  });
});

describe("withoutBlanks", () => {
  it("drops empty and whitespace-only values and keeps the rest", () => {
    expect(withoutBlanks({ A: "", B: "  ", C: "x", D: undefined })).toEqual({ C: "x" });
  });
});
