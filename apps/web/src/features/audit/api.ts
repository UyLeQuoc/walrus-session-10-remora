/**
 * U19 B1 (ADR-0145): the auditor-access calls. The owner's go through the signed-in session; the
 * auditor's page reads only the public `GET /api/audit/:capsuleId`.
 */
import { AuditAccess, AuditDraft, AuditShare } from "@remora/schema";
import { z } from "zod";
import { call } from "@/features/remoras/api";

const ShareTx = z.object({ transaction: z.string(), draft: AuditDraft });
const Tx = z.object({ transaction: z.string().nullable() });
const Confirmed = z.object({ capsuleId: z.string(), digest: z.string() });

export const auditApi = {
  shares: (id: string) =>
    call("GET", `/api/remoras/${id}/audits`, z.object({ shares: z.array(AuditShare) })),
  shareTx: (
    id: string,
    b: { from: string; to: string; auditor: string; days: number; includeQuestions: boolean },
  ) => call("POST", `/api/remoras/${id}/audits`, ShareTx, b),
  confirm: (id: string, digest: string, draft: AuditDraft) =>
    call("POST", `/api/remoras/${id}/audits/confirm`, Confirmed.extend({ path: z.string() }), {
      digest,
      draft,
    }),
  revokeTx: (id: string, capsuleId: string) =>
    call("POST", `/api/remoras/${id}/audits/${capsuleId}/revoke`, Tx),
  revokeConfirm: (id: string, capsuleId: string, digest: string) =>
    call("POST", `/api/remoras/${id}/audits/${capsuleId}/revoke/confirm`, Confirmed, { digest }),
  /** Public: what the page needs to fetch and decrypt the bundle. */
  access: (capsuleId: string) =>
    call("GET", `/api/audit/${encodeURIComponent(capsuleId)}`, AuditAccess),
};
