/**
 * H5 + H1: who hears about what, and when. Owner settings (A7) decide: `all` sends every ping,
 * `important` sends urgent ones and leaves the rest to the feed and digest, `digest` sends nothing live.
 * Quiet hours hold back everything that isn't urgent. Delivery is Telegram when the owner linked it
 * (A5); the web feed always has the event.
 */
import { and, channelIdentities, type Db, eq, ownerSettings, people } from "@remora/db";

export interface Button {
  label: string;
  url?: string;
  data?: string;
}

export interface Notice {
  text: string;
  urgent?: boolean;
  buttons?: Button[];
}

export type Delivery = "sent" | "quiet" | "digest" | "no_channel";

export interface Policy {
  notify: "all" | "important" | "digest";
  timezone: string;
  quietStart: string | null;
  quietEnd: string | null;
}

/** "HH:MM" in the owner's timezone, wrapping past midnight ("23:00"–"07:00"). */
export function inQuietHours(p: Policy, now: Date): boolean {
  if (!p.quietStart || !p.quietEnd) return false;
  const local = new Intl.DateTimeFormat("en-GB", {
    timeZone: p.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const [s, e, t] = [p.quietStart, p.quietEnd, local];
  return s <= e ? t >= s && t < e : t >= s || t < e;
}

export function decide(p: Policy, n: Notice, now: Date): "send" | "quiet" | "digest" {
  if (p.notify === "digest") return "digest";
  if (p.notify === "important" && !n.urgent) return "digest";
  if (!n.urgent && inQuietHours(p, now)) return "quiet";
  return "send";
}

export interface Notifier {
  send(owner: string, n: Notice): Promise<Delivery>;
}

export function createNotifier(deps: {
  db: Db;
  telegram?: (chatId: string, n: Notice) => Promise<void>;
  now?: () => Date;
}): Notifier {
  return {
    async send(owner, n) {
      const [s] = await deps.db
        .select()
        .from(ownerSettings)
        .where(eq(ownerSettings.ownerAddress, owner));
      const policy: Policy = {
        notify: s?.notify ?? "important",
        timezone: s?.timezone ?? "UTC",
        quietStart: s?.quietStart ?? null,
        quietEnd: s?.quietEnd ?? null,
      };
      const d = decide(policy, n, deps.now?.() ?? new Date());
      if (d !== "send") return d;
      if (!deps.telegram) return "no_channel";
      const [chat] = await deps.db
        .select({ externalId: channelIdentities.externalId })
        .from(people)
        .innerJoin(channelIdentities, eq(channelIdentities.personId, people.id))
        .where(and(eq(people.walletAddress, owner), eq(channelIdentities.channel, "telegram")))
        .limit(1);
      if (!chat) return "no_channel";
      await deps.telegram(chat.externalId, n);
      return "sent";
    },
  };
}
