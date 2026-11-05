/** A4 + A3 (ADR-0146, ADR-0147): import into memory, and tidy it, as the server serves them. */
import { z } from "zod";
import { call } from "@/features/remoras/api";

export const ImportCandidate = z.object({
  i: z.number(),
  text: z.string(),
  at: z.string().nullable(),
  via: z.enum(["analyze", "lines"]),
  flag: z.string().nullable(),
});
export type ImportCandidate = z.infer<typeof ImportCandidate>;

export const ImportPreview = z.object({
  previewId: z.string(),
  fileName: z.string(),
  sha8: z.string(),
  kind: z.enum(["claude", "agents", "cursor", "chatgpt", "markdown"]),
  chunks: z.number(),
  analyzed: z.number(),
  failed: z.number(),
  scrubbed: z.array(z.string()),
  candidates: z.array(ImportCandidate),
  namespaces: z.array(z.string()),
  defaultNamespace: z.string(),
  maxTicked: z.number(),
  source: z.string(),
  expiresAt: z.string(),
});
export type ImportPreview = z.infer<typeof ImportPreview>;

export const ImportCommitted = z.object({
  namespace: z.string(),
  source: z.string(),
  written: z.number(),
  skipped: z.number(),
  indexIds: z.array(z.string()),
  note: z.string(),
});
export type ImportCommitted = z.infer<typeof ImportCommitted>;

const ConflictOption = z.object({
  label: z.string(),
  at: z.string(),
  blobIds: z.array(z.string()).optional(),
  value: z.string().optional(),
  ruleId: z.string().optional(),
});

export const TidyView = z.object({
  runs: z.array(
    z.object({
      id: z.string(),
      at: z.string(),
      trigger: z.enum(["weekly", "owner"]),
      summary: z.string(),
      merged: z.array(
        z.object({
          service: z.string(),
          verdict: z.enum(["useful", "noise"]),
          value: z.string(),
          blobIds: z.array(z.string()),
          noteId: z.string().nullable(),
          noteBlobId: z.string().nullable(),
        }),
      ),
      hidden: z.array(z.string()),
      conflicts: z.array(z.string()),
    }),
  ),
  conflicts: z.array(
    z.object({
      id: z.string(),
      createdAt: z.string(),
      summary: z.string(),
      service: z.string(),
      what: z.enum(["notes", "rules"]),
      a: ConflictOption,
      b: ConflictOption,
    }),
  ),
});
export type TidyView = z.infer<typeof TidyView>;

const TidyNow = TidyView.extend({ note: z.string() });

export const memoryApi = {
  importPreview: (id: string, b: { fileName?: string; text: string }) =>
    call("POST", `/api/remoras/${id}/import/preview`, ImportPreview, b),
  importCommit: (id: string, b: { previewId: string; ticked: number[]; namespace: string }) =>
    call("POST", `/api/remoras/${id}/import/commit`, ImportCommitted, b),
  tidy: (id: string) => call("GET", `/api/remoras/${id}/tidy`, TidyView),
  tidyNow: (id: string) => call("POST", `/api/remoras/${id}/tidy`, TidyNow),
  resolveConflict: (approvalId: string, keep: "a" | "b") =>
    call("POST", `/api/approvals/${approvalId}/conflict-resolve`, z.object({}).loose(), { keep }),
  dismissConflict: (approvalId: string) =>
    call(
      "POST",
      `/api/approvals/${approvalId}/conflict-dismiss`,
      z.object({ dismissed: z.boolean() }),
    ),
};
