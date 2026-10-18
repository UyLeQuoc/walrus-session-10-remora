import { z } from "zod";

const EnokiEnv = z.object({
  apiKey: z.string().startsWith("enoki_public_"),
  clientId: z.string().endsWith(".apps.googleusercontent.com"),
  redirectUrl: z.string().url().optional(),
});

export type EnokiConfig = z.infer<typeof EnokiEnv>;

export function enokiConfig(env: Record<string, unknown>): EnokiConfig | null {
  const parsed = EnokiEnv.safeParse({
    apiKey: env.VITE_ENOKI_API_KEY,
    clientId: env.VITE_GOOGLE_CLIENT_ID,
    redirectUrl: env.VITE_ENOKI_REDIRECT_URL || undefined,
  });
  return parsed.success ? parsed.data : null;
}

/**
 * Google must list the redirect exactly, and Enoki defaults it to the current
 * URL, which on /connect carries a one-time token. The origin's root is one
 * address per origin that can be registered ahead of time, as WalForm does.
 */
export function googleRedirect(config: EnokiConfig, origin: string): string {
  return config.redirectUrl ?? `${origin}/`;
}
