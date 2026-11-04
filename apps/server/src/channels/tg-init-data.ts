/**
 * H3 (ADR-0115): Telegram Mini App launch data. Telegram signs `initData` with the bot's token:
 * `secret = HMAC_SHA256(key "WebAppData", bot token)`, then `hash = HMAC_SHA256(secret, the other
 * fields sorted, "key=value" joined by "\n")`. Only the bot's server can check it. It's fresh for a
 * day.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface TgUser {
  id: string;
  name: string;
  authDate: number;
}

export function verifyInitData(
  initData: string,
  botToken: string,
  o: { now?: number; maxAgeS?: number } = {},
): TgUser | null {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete("hash");
  const check = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const want = createHmac("sha256", secret).update(check).digest();
  const got = Buffer.from(hash, "hex");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  const authDate = Number(params.get("auth_date"));
  const now = (o.now ?? Date.now()) / 1000;
  if (!Number.isFinite(authDate) || now - authDate > (o.maxAgeS ?? 86_400)) return null;
  try {
    const user = JSON.parse(params.get("user") ?? "") as {
      id?: number;
      username?: string;
      first_name?: string;
    };
    if (typeof user.id !== "number") return null;
    return { id: String(user.id), name: user.username ?? user.first_name ?? "", authDate };
  } catch {
    return null;
  }
}

/** Signs launch data the way Telegram does: for tests and local runs of the Mini App. */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const check = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}
