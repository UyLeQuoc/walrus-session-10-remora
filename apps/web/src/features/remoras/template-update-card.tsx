/**
 * D3 (ADR-0150): the template this remora was hatched from has a new version. The card shows what
 * would change, field by field (persona, brain, triggers, Reef services, rules, spending limit).
 * Accept applies the settings that don't touch money now, as one version in History; the spending
 * limit and the services are a separate signature, never applied by themselves. Decline is
 * remembered, and that version isn't offered again.
 */
import type {
  RemoraView,
  TemplateUpdate,
  TemplateUpdateAccept,
  TemplateUpdateChange,
} from "@remora/schema";
import { ArrowRight, Check, PenLine, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Section } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useSignAndRun } from "@/features/funds/sign";
import { extrasApi } from "@/features/hatchery/extras-api";
import { api } from "./api";
import { valueLine } from "./history";
import { useLoad } from "./hooks";

const usd = (n: number) => (n < 0.1 ? n.toFixed(3).replace(/0$/, "") : n.toFixed(2));

/** A value of the update's diff as one short line. */
export function updateLine(c: Pick<TemplateUpdateChange, "field">, v: unknown): string {
  if (v === undefined || v === null) return c.field === "model" ? "Default" : "—";
  if (c.field === "budget" && typeof v === "object") {
    const b = v as { monthlyUsd?: number; perPaymentUsd?: number };
    if (typeof b.monthlyUsd === "number" && typeof b.perPaymentUsd === "number")
      return `${usd(b.monthlyUsd)} USDC a month, at most ${usd(b.perPaymentUsd)} a payment`;
  }
  if ((c.field === "rules" || c.field === "tools") && Array.isArray(v))
    return v.length ? v.map(String).join(" · ") : "None";
  if (c.field === "triggers" && Array.isArray(v)) {
    if (!v.length) return "None";
    return v
      .map((t) => {
        const x = t as { kind?: string; name?: string; paused?: boolean };
        if (x.kind === "webhook") return `Webhook${x.name ? ` “${x.name}”` : ""}`;
        return valueLine("triggers", [t]) + (x.paused ? " (paused)" : "");
      })
      .join(" · ");
  }
  return valueLine(c.field, v);
}

function Diff({ changes }: { changes: TemplateUpdateChange[] }) {
  if (!changes.length)
    return <p className="text-md text-ob-muted">It already matches this version.</p>;
  return (
    <dl className="flex flex-col gap-2 text-md" data-testid="update-diff">
      {changes.map((c) => (
        <div key={c.field} className="grid gap-1 sm:grid-cols-[9rem_1fr]" data-field={c.field}>
          <dt className="text-ob-secondary">
            {c.label}
            {c.apply === "signature" ? (
              <Badge variant="outline" className="ml-2">
                sign
              </Badge>
            ) : c.apply === "none" ? (
              <Badge variant="outline" className="ml-2">
                shown only
              </Badge>
            ) : null}
          </dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0 break-words text-ob-muted line-through decoration-ob-border-strong">
              {updateLine(c, c.current)}
            </span>
            <ArrowRight className="size-3.5 shrink-0 text-ob-muted" aria-label="becomes" />
            {/* The author's words: plain text. */}
            <span className="min-w-0 break-words text-ob-text" data-ux-skip>
              {updateLine(c, c.next)}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function TemplateUpdateCard({
  r,
  onChanged,
  open: focus = false,
}: {
  r: RemoraView;
  onChanged?: () => void;
  /** From a notification's link (`?update=…`): scroll it into view. */
  open?: boolean;
}) {
  const view = useLoad(() => extrasApi.templateUpdates(r.id), [r.id, r.updatedAt]);
  const run = useSignAndRun();
  const [busy, setBusy] = useState<"" | "accept" | "decline" | "sign">("");
  const [declining, setDeclining] = useState(false);
  const [why, setWhy] = useState("");
  const [error, setError] = useState("");
  const u = view.data?.open;
  if (!u || r.status === "retired") return null;
  const money = u.changes.filter((c) => c.apply === "signature");
  const now = u.changes.filter((c) => c.apply === "direct");

  /** Signs the money part and lets the usual confirm apply it. */
  const signMoney = async (sign: NonNullable<TemplateUpdateAccept["sign"]>) => {
    const digest = await run(sign.transaction);
    const done =
      sign.kind === "budget"
        ? await api.budgetConfirm(r.id, digest, sign.budget)
        : await api.payeesConfirm(r.id, digest, sign.payees);
    if (!done.ok) throw new Error(done.error);
  };
  const getSign = async (x: TemplateUpdate) => {
    const out = await extrasApi.updateSign(r.id, x.id);
    if (!out.ok) throw new Error(out.error);
    return out.data.sign;
  };

  const accept = async (x: TemplateUpdate) => {
    setBusy("accept");
    setError("");
    try {
      const out = await extrasApi.acceptUpdate(r.id, x.id);
      if (!out.ok) throw new Error(out.error);
      if (out.data.applied.length) onChanged?.();
      if (out.data.sign) {
        try {
          await signMoney(out.data.sign);
        } catch (err) {
          throw new Error(
            `${out.data.applied.length ? "The rest applied, but its" : "Its"} spending limit didn't change: ${(err as Error).message}`,
          );
        }
        onChanged?.();
      }
      toast.success(`Took v${x.version}. History shows it.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
      void view.refresh();
    }
  };

  const signLater = async (x: TemplateUpdate) => {
    setBusy("sign");
    setError("");
    try {
      const sign = await getSign(x);
      if (sign) await signMoney(sign);
      onChanged?.();
      toast.success("Signed. Its spending limit matches the template now.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
      void view.refresh();
    }
  };

  const decline = async (x: TemplateUpdate) => {
    setBusy("decline");
    setError("");
    const out = await extrasApi.declineUpdate(r.id, x.id, why);
    setBusy("");
    if (!out.ok) return setError(out.error);
    setDeclining(false);
    setWhy("");
    toast.success("Declined. It remembers, and won't offer this version again.");
    void view.refresh();
  };

  return (
    <Section
      title="Template update"
      hint="Its template's author published a new version. Nothing changes until you accept."
    >
      <div
        className="flex flex-col gap-3 rounded-lg border border-ob-accent/40 bg-ob-accent/5 p-4"
        data-testid="template-update"
        ref={(el) => {
          if (el && focus) el.scrollIntoView({ block: "center" });
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge>
            <Sparkles className="size-3" aria-hidden /> v{u.version}
          </Badge>
          <b className="text-lg" data-ux-skip>
            {u.template}
          </b>
          <Link className="link text-sm" to={`/hatchery/${u.to}`}>
            See the template
          </Link>
        </div>
        {u.status === "approved" ? (
          <>
            <p className="text-md text-ob-secondary">
              You took v{u.version}. Its spending part waits for your signature:
            </p>
            <Diff changes={money} />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy !== ""}
                onClick={() => void signLater(u)}
                data-testid="update-sign"
              >
                {busy === "sign" ? <Spinner /> : <PenLine className="size-4" aria-hidden />} Sign
                the new limit
              </Button>
            </div>
          </>
        ) : (
          <>
            <Diff changes={u.changes} />
            <p className="text-xs text-ob-muted">
              {now.length ? `${now.map((c) => c.label).join(", ")} change when you accept. ` : ""}
              {money.length
                ? `${money.map((c) => c.label).join(" and ")}: a separate signature, never applied by itself.`
                : ""}
            </p>
            {declining ? (
              <div className="flex flex-wrap gap-2">
                <Input
                  aria-label="Why not? (optional)"
                  placeholder="Why not? It remembers."
                  value={why}
                  maxLength={200}
                  className="min-w-0 flex-1"
                  onChange={(e) => setWhy(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== ""}
                  onClick={() => void decline(u)}
                  data-testid="update-decline-send"
                >
                  {busy === "decline" ? <Spinner /> : null} Decline
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={busy !== ""}
                  onClick={() => void accept(u)}
                  data-testid="update-accept"
                >
                  {busy === "accept" ? <Spinner /> : <Check className="size-4" aria-hidden />}{" "}
                  {money.length ? "Accept · then sign the limit" : "Accept"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== ""}
                  onClick={() => setDeclining(true)}
                  data-testid="update-decline"
                >
                  <X className="size-4" aria-hidden /> Decline
                </Button>
              </div>
            )}
          </>
        )}
        {error ? <p className="text-md text-ob-danger-text">{error}</p> : null}
      </div>
    </Section>
  );
}
