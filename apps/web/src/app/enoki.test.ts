import { describe, expect, it } from "vitest";
import { enokiConfig, googleRedirect } from "./enoki.ts";

const KEYS = {
  VITE_ENOKI_API_KEY: "enoki_public_abc",
  VITE_GOOGLE_CLIENT_ID: "123-x.apps.googleusercontent.com",
};

describe("enokiConfig", () => {
  it("reads a public Enoki key and a Google client id", () => {
    expect(enokiConfig(KEYS)).toEqual({
      apiKey: "enoki_public_abc",
      clientId: "123-x.apps.googleusercontent.com",
    });
  });

  it("offers no Google sign-in when either value is missing or is the wrong kind", () => {
    expect(enokiConfig({})).toBeNull();
    expect(enokiConfig({ VITE_ENOKI_API_KEY: "enoki_public_abc" })).toBeNull();
    expect(enokiConfig({ ...KEYS, VITE_ENOKI_API_KEY: "enoki_private_abc" })).toBeNull();
  });
});

describe("googleRedirect", () => {
  it("sends Google back to the origin's root, never to the page that started it", () => {
    const config = enokiConfig({ ...KEYS, VITE_ENOKI_REDIRECT_URL: "" });
    expect(config && googleRedirect(config, "https://ask-hippo.vercel.app")).toBe(
      "https://ask-hippo.vercel.app/",
    );
  });

  it("uses an explicit redirect when one is configured", () => {
    const config = enokiConfig({ ...KEYS, VITE_ENOKI_REDIRECT_URL: "https://example.com/" });
    expect(config && googleRedirect(config, "http://localhost:5173")).toBe("https://example.com/");
  });
});
