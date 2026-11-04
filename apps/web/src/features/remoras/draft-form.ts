/**
 * C1 (ADR-0123): a drafted remora as the create form's fields, and back. The form stays the one the
 * template picker fills; a draft only sets its values, plus what the picker never had (a persona, a
 * schedule, rules), which go to `/api/remoras/:id/setup` after the hatch.
 */
import type { RemoraDraft } from "@remora/schema";
import { usdc } from "@/lib/usdc";

export interface DraftForm {
  slug: string;
  name: string;
  monthly: string;
  perPayment: string;
  /** Null: the kind's own payees. */
  payees: string[] | null;
  watch: string;
  follow: string;
  persona: string;
  when: string;
  question: string;
  rules: string;
}

export function formFromDraft(d: RemoraDraft): Partial<DraftForm> {
  return {
    ...(d.template ? { slug: d.template } : {}),
    name: d.name,
    persona: d.persona,
    ...(d.budget
      ? {
          monthly: usdc(d.budget.windowLimit),
          perPayment: usdc(d.budget.perPaymentCap),
          payees: d.budget.payees,
        }
      : { payees: null }),
    ...(d.watch.length ? { watch: d.watch.join("\n") } : {}),
    ...(d.items.length ? { follow: d.items.join("\n") } : {}),
    when: d.schedule?.when ?? "",
    question: d.schedule?.question ?? "",
    rules: d.rules.join("\n"),
  };
}

const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * What to send to setup once it's hatched: only what the owner kept from a draft and the kind's
 * defaults don't already have. Null when there's nothing to add.
 */
export function setupFromForm(
  f: Pick<DraftForm, "slug" | "persona" | "when" | "question" | "rules">,
  kindPersona: string | undefined,
): { persona?: string; schedule?: { when: string; question: string }; rules?: string[] } | null {
  const persona = f.persona.trim();
  const rules = f.slug === "sentinel" ? lines(f.rules) : [];
  const when = f.when.trim();
  const out = {
    ...(persona && persona !== kindPersona?.trim() ? { persona } : {}),
    ...(when && f.slug !== "sentinel" ? { schedule: { when, question: f.question.trim() } } : {}),
    ...(rules.length ? { rules } : {}),
  };
  return Object.keys(out).length ? out : null;
}
