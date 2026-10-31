/**
 * What a remora does, in words for its owner. `config.persona` is the system prompt ("You are Scout.
 * You answer the owner's questions…"), written for the model, so it isn't shown as is (ADR-0088):
 * - an unchanged template persona shows the template's summary;
 * - an edited one drops its opening "You are <name>." sentence.
 */
import type { Template } from "@remora/schema";
import { api } from "./api";
import { useLoad } from "./hooks";

type Catalog = Record<string, Pick<Template, "persona" | "summary">>;

export function describeRemora(
  r: { template: string; config: { persona: string } },
  templates?: Catalog | null,
): string {
  const t = templates?.[r.template];
  if (t && t.persona.trim() === r.config.persona.trim()) return t.summary;
  const rest = r.config.persona.replace(/^\s*You are [^.!?]{1,60}[.!?]\s*/i, "").trim();
  return rest || t?.summary || r.config.persona;
}

/** The template catalog for `describeRemora`; until it loads (or if it can't), personas are trimmed. */
export function useTemplateCatalog(): Catalog | null {
  return useLoad(() => api.templates(), []).data?.templates ?? null;
}
