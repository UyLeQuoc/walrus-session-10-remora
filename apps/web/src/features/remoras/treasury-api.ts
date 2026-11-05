/**
 * C3 (ADR-0148): the Treasurer's calls. Its card reads `GET /api/remoras/:id/treasury`; requests it
 * prepares are ordinary approvals, paid with `api.approvalPayTx` and `api.approvalPay`.
 */
import { CreateRemoraResponse } from "@remora/schema";
import { z } from "zod";
import { apiFetch, errorMessage } from "@/lib/api";
import { call, type Result } from "./api";

const CoinFlow = z.object({
  coinType: z.string(),
  symbol: z.string(),
  decimals: z.number(),
  in: z.string(),
  out: z.string(),
});

export const TreasuryReport = z.object({
  from: z.string(),
  to: z.string(),
  days: z.number(),
  transfers: z.number(),
  coins: z.array(
    CoinFlow.extend({
      internal: z.string(),
      balance: z.string().nullable(),
      burnPerDay: z.string(),
      runwayDays: z.number().nullable(),
    }),
  ),
  addresses: z.array(
    z.object({
      address: z.string(),
      label: z.string().nullable(),
      suins: z.string().nullable(),
      flows: z.array(CoinFlow),
    }),
  ),
  counterparties: z.array(
    CoinFlow.extend({ address: z.string(), team: z.string().nullable(), transfers: z.number() }),
  ),
});
export type TreasuryReport = z.infer<typeof TreasuryReport>;

const Check = z.object({ ok: z.boolean(), text: z.string() });

export const TreasuryView = z.object({
  watch: z.array(
    z.object({ address: z.string(), label: z.string().nullable(), suins: z.string().nullable() }),
  ),
  contacts: z.array(
    z.object({ name: z.string(), address: z.string(), suins: z.string().nullable() }),
  ),
  limits: z.object({
    perRequestCap: z.string(),
    monthlyCap: z.string(),
    askedThisMonth: z.string(),
  }),
  reports: z.array(
    z.object({
      id: z.string(),
      at: z.string(),
      lines: z.array(z.string()),
      report: TreasuryReport,
      shareUrl: z.string().nullable(),
    }),
  ),
  pending: z.array(
    z.object({
      approvalId: z.string(),
      summary: z.string(),
      payTo: z.string(),
      amount: z.string(),
      reason: z.string(),
      suins: z.string().nullable(),
      from: z.string(),
      checks: z.array(Check),
      createdAt: z.string(),
    }),
  ),
});
export type TreasuryView = z.infer<typeof TreasuryView>;

export const TreasuryRequestResult = z.object({
  answer: z.string(),
  outcome: z.enum(["asked", "declined", "unclear"]),
  approvalId: z.string().optional(),
  checks: z.array(Check),
});

/** What `/t/:token` shows: no full addresses, names, requests or memos (ADR-0148). */
export const PublicReport = z.object({
  v: z.literal(1),
  remora: z.string(),
  network: z.string(),
  from: z.string(),
  to: z.string(),
  days: z.number(),
  transfers: z.number(),
  coins: z.array(
    z.object({
      symbol: z.string(),
      decimals: z.number(),
      in: z.string(),
      out: z.string(),
      internal: z.string(),
      balance: z.string().nullable(),
      burnPerDay: z.string(),
      runwayDays: z.number().nullable(),
    }),
  ),
  addresses: z.array(
    z.object({
      label: z.string(),
      address: z.string(),
      flows: z.array(
        z.object({ symbol: z.string(), decimals: z.number(), in: z.string(), out: z.string() }),
      ),
    }),
  ),
  counterparties: z.array(
    z.object({
      who: z.string(),
      symbol: z.string(),
      decimals: z.number(),
      in: z.string(),
      out: z.string(),
      transfers: z.number(),
    }),
  ),
});
export type PublicReport = z.infer<typeof PublicReport>;

export interface TreasurySetupIn {
  name?: string;
  watch: { label?: string; address: string }[];
  contacts?: { name: string; address: string }[];
  perRequestCap?: string;
  monthlyCap?: string;
}

const Share = z.object({ token: z.string(), url: z.string() });

export const treasuryApi = {
  create: (input: TreasurySetupIn) => call("POST", "/api/treasury", CreateRemoraResponse, input),
  view: (id: string) => call("GET", `/api/remoras/${id}/treasury`, TreasuryView),
  setup: (id: string, input: TreasurySetupIn) =>
    call("PUT", `/api/remoras/${id}/treasury`, TreasuryView.loose(), input),
  report: (id: string) => call("POST", `/api/remoras/${id}/treasury/report`, TreasuryView),
  request: (id: string, text: string) =>
    call("POST", `/api/remoras/${id}/treasury/request`, TreasuryRequestResult, { text }),
  share: (reportId: string) => call("POST", `/api/treasury/reports/${reportId}/share`, Share),
  unshare: (reportId: string) =>
    call("DELETE", `/api/treasury/reports/${reportId}/share`, z.object({ ok: z.boolean() })),
};

/** The public, redacted report; no session. */
export async function fetchPublicReport(token: string): Promise<Result<PublicReport | null>> {
  try {
    const res = await apiFetch(`/api/public/treasury/${encodeURIComponent(token)}`);
    if (res.status === 404) return { ok: true, data: null };
    if (!res.ok) return { ok: false, error: await errorMessage(res, "Something went wrong.") };
    const parsed = PublicReport.safeParse(await res.json().catch(() => null));
    return parsed.success
      ? { ok: true, data: parsed.data }
      : { ok: false, error: "The server answered in a shape this page doesn't know." };
  } catch {
    return { ok: false, error: "Can't reach the server." };
  }
}

/** Smallest units → "0.30", "0.0103": at least two decimals (the server's `fmtUnits`). */
export function units(a: string, decimals: number): string {
  const v = Number(a) / 10 ** decimals;
  const s = v.toFixed(Math.abs(v) > 0 && Math.abs(v) < 0.0001 ? decimals : 4);
  const [w = "0", f = ""] = s.split(".");
  return `${w}.${f.replace(/0+$/, "").padEnd(2, "0")}`;
}

/**
 * "Ops 0x…", "huy.sui", "Design huy.sui" per line → watch entries; the server resolves names.
 * A line whose last word isn't an address or a name is skipped.
 */
export function parseWatch(text: string): { label?: string; address: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const m =
        /^(.*?)[\s,:]*(0x[0-9a-fA-F]{1,64}|@[a-z0-9-]{3,63}|(?:[a-z0-9-]{1,63}\.)+sui)$/i.exec(
          line,
        );
      if (!m) return [];
      const label = (m[1] ?? "").trim();
      return [{ ...(label ? { label } : {}), address: m[2] ?? "" }];
    });
}
