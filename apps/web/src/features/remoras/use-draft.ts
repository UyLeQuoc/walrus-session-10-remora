/** C1 (ADR-0123): "What should it do?" → a draft for the create form, a refusal, or an error. */
import type { DraftIssue, RemoraDraft } from "@remora/schema";
import { useState } from "react";
import { api } from "./api";

export type DraftState =
  | { kind: "idle" }
  | { kind: "drafting" }
  | { kind: "drafted"; draft: RemoraDraft; issues: DraftIssue[] }
  | { kind: "refused"; reason: string }
  | { kind: "failed"; error: string };

export function useDraft(onDraft: (draft: RemoraDraft) => void) {
  const [state, setState] = useState<DraftState>({ kind: "idle" });
  const describe = async (text: string) => {
    if (!text.trim()) return;
    setState({ kind: "drafting" });
    const out = await api.draft(text.trim());
    if (!out.ok) return setState({ kind: "failed", error: out.error });
    if (!out.data.ok) return setState({ kind: "refused", reason: out.data.refused });
    onDraft(out.data.draft);
    setState({ kind: "drafted", draft: out.data.draft, issues: out.data.issues });
  };
  return { state, describe };
}
