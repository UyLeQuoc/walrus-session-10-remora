/**
 * Copy v1 (H0, first drafts by Uy's agent under ADR-0027; Huấn owns the voice): every sentence and
 * button the channels and the UI send, by `packages/schema` copy key. `{name}` placeholders are
 * filled by `render`; a missing value throws, so a half-filled sentence never ships.
 */
import type { CopyKey } from "@remora/schema";

export const COPY_TEXT = {
  "remora.created":
    "{remora} is ready. It starts in shadow mode: it tells you what it would do, and spends nothing.",
  "remora.shadow_started":
    "{remora} is shadowing. For the next {days} days it only says what it would have done.",
  "remora.activated":
    "{remora} is live. It can spend up to {limit} USDC per {window}, only through its Disc.",
  "remora.paused": "{remora} is paused. Its Disc can't spend until you resume it.",
  "remora.resumed": "{remora} is back on.",
  "remora.retired": "{remora} is retired. Its Disc is revoked and its memory stays yours.",
  "remora.key_rotated":
    "{remora} has a new key. The old one can't spend anymore; the budget is unchanged.",
  "ping.chain_event": "{summary}",
  "digest.morning": "Good morning. {count} things happened overnight: {summary}",
  "payment.made": "Paid {amount} USDC to {payee}. Receipt: {tx}",
  "payment.blocked": "I didn't pay {payee}: {reason}",
  "approval.needed": "{remora} wants to {summary}. Approve?",
  "rule.learned": "Got it. From now on: {rule}",
  "rule.undone": "Undone. I've stopped using: {rule}",
  "handoff.sent": "Asked {to} to help: {summary}",
  "shadow.would_have": "In shadow mode, I would have: {summary}",
  "why.title": "Why I did this",
  "button.why": "Why?",
  "button.teach": "Teach",
  "button.mute": "Mute",
  "button.approve": "Approve",
  "button.reject": "Reject",
  "button.useful": "Useful",
  "button.noise": "Noise",
  "button.snooze": "Snooze",
  "error.disc.paused": "This remora's budget is paused. Resume it to let it spend.",
  "error.disc.payee_not_allowed": "{payee} isn't on this remora's list of services it may pay.",
  "error.disc.over_per_payment_cap": "That's more than this remora may pay at once ({cap} USDC).",
  "error.disc.not_owner": "Only the owner can change this budget.",
  "error.disc.not_spender": "This remora's key was replaced. It's using the new one now.",
  "error.disc.wrong_disc": "Something didn't match on our side. Nothing was paid.",
  "error.disc.exists": "You already have a budget with that name.",
  "error.disc.bad_intent": "The payment wasn't tied to a receipt, so it was stopped.",
  "error.disc.outdated": "This budget needs a quick update before it can pay.",
  "error.allowance.over_window_limit":
    "This remora has spent its limit for this {window}. It can spend again {when}.",
  "error.allowance.over_lifetime_cap":
    "This remora has spent its whole budget. Raise it to continue.",
  "error.allowance.not_started": "This budget starts {when}.",
  "error.allowance.expired": "This budget has expired. Renew it to continue.",
  "error.allowance.revoked": "This budget was revoked.",
  "error.funds.insufficient_address_balance":
    "Your address balance is too low. Move USDC into it from Funds.",
  "error.funds.settling": "Your deposit is still settling. Try again in a few seconds.",
  "error.relayer.slow": "Memory is slow right now. I'll keep trying.",
  "error.relayer.write_failed": "I couldn't save that to memory. I'll retry.",
  "error.relayer.recall_dropped": "Some memories didn't come back this time.",
  "error.sponsor.out_of_gas": "This remora used up today's gas allowance. It continues tomorrow.",
  "error.sonar.blocked": "I stopped this: {reason}",
  "error.rate_limited": "Too many requests. Give it a moment.",
  "error.unknown": "Something went wrong. Nothing was paid.",
} as const satisfies Record<CopyKey, string>;

/**
 * Copy for codes proposed in contract PR #4 (network, funds, x402). Once #4 merges they're `CopyKey`s
 * and move into `COPY_TEXT`; the test fails until they do.
 */
export const PENDING_COPY: Record<string, string> = {
  "error.network.unavailable": "{network} isn't available yet.",
  "error.funds.bad_address": "That doesn't look like a Sui address.",
  "error.funds.bad_request": "Something was missing from that request.",
  "error.funds.no_coins": "There are no coins to move.",
  "error.x402.no_matching_requirements": "That service doesn't accept payment on this network.",
  "error.x402.over_soft_budget": "That costs more than I'm allowed to spend on one call.",
  "error.x402.gas_station_refused": "The payment couldn't be sponsored: {reason}",
};

const TEXT: Record<string, string> = { ...COPY_TEXT, ...PENDING_COPY };

/** Fills `{name}` placeholders. Throws on an unknown key or a missing value. */
export function render(
  key: CopyKey | keyof typeof PENDING_COPY,
  vars: Record<string, string | number> = {},
): string {
  const text = TEXT[key];
  if (text === undefined) throw new Error(`no copy for ${key}`);
  return text.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = vars[name];
    if (v === undefined) throw new Error(`copy ${key} needs {${name}}`);
    return String(v);
  });
}

/** The placeholders a key needs, for callers and tests. */
export function placeholders(key: string): string[] {
  return [...(TEXT[key] ?? "").matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "");
}
