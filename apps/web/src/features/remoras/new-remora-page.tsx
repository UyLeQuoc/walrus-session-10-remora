/**
 * `/remoras/new` (A6 + B1·ui): pick a template as a card, name it, set its budget or what it
 * watches, sign one transaction for the Disc (Scout) or none (Sentinel), and land on its page while
 * its first run (N13) comes in. Each wait says what it is waiting for (N6).
 */

import type { Template } from "@remora/schema";
import { Package, Shield } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Page, PageHeader } from "@/components/app/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Hint } from "@/components/visual";
import { useSignAndRun } from "@/features/funds/sign";
import { useNetworks } from "@/features/network/use-networks";
import { payeeName } from "@/lib/payee";
import { parseUsdc } from "@/lib/usdc";
import { Property, PropertyList } from "@/openbot/pages";
import { api } from "./api";
import { RequireOwner, useLoad } from "./hooks";

type Step = "idle" | "creating" | "signing" | "confirming";
const STEP_TEXT: Record<Step, string> = {
  idle: "",
  creating: "Creating its key…",
  signing: "Sign the budget in your wallet…",
  confirming: "Confirming onchain…",
};

function Wizard({ owner }: { owner: string }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const run = useSignAndRun();
  const { network, networks } = useNetworks();
  const templates = useLoad(() => api.templates(), []);
  const [slug, setSlug] = useState(() => params.get("template") ?? "scout");
  const [name, setName] = useState("");
  const [monthly, setMonthly] = useState("1");
  const [perPayment, setPerPayment] = useState("0.05");
  const [watch, setWatch] = useState(owner);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  const list = Object.entries(templates.data?.templates ?? {}) as [string, Template][];
  const chosen = templates.data?.templates[slug];
  const coinType = networks.find((n) => n.network === network)?.usdcCoinType;
  const busy = step !== "idle";

  const create = async () => {
    setError("");
    let budget: unknown;
    if (slug === "scout") {
      const limit = parseUsdc(monthly);
      const cap = parseUsdc(perPayment);
      if (!limit || !cap || cap > limit)
        return setError("Set a monthly limit and a smaller per-payment cap.");
      if (!coinType) return setError("This network isn't available yet.");
      budget = {
        coinType,
        windowLimit: limit.toString(),
        window: "month",
        perPaymentCap: cap.toString(),
        payees: chosen?.payees ?? [],
      };
    }
    const addresses = watch.split(/[\s,]+/).filter(Boolean);
    if (
      slug === "sentinel" &&
      (!addresses.length || addresses.some((a) => !/^0x[0-9a-fA-F]{1,64}$/.test(a)))
    )
      return setError("Watch one or more Sui addresses (0x…).");
    setStep("creating");
    const made = await api.create({
      template: slug,
      ...(name.trim() ? { name: name.trim() } : {}),
      ...(budget ? { budget } : {}),
      ...(slug === "sentinel" ? { watch: addresses } : {}),
    });
    if (!made.ok) {
      setStep("idle");
      return setError(made.error);
    }
    const id = made.data.remora.id;
    if (made.data.transaction) {
      try {
        setStep("signing");
        const digest = await run(made.data.transaction);
        setStep("confirming");
        const ok = await api.confirm(id, digest);
        if (!ok.ok) throw new Error(ok.error);
      } catch (err) {
        setStep("idle");
        return setError(`${(err as Error).message} Your remora is saved; finish from its page.`);
      }
    }
    navigate(`/remoras/${id}?new=1`);
  };

  // ADR-0103: the two limits as one number you can picture, from what you typed: how many payments
  // of the largest size the month holds (smaller ones fit more).
  const limitUnits = parseUsdc(monthly);
  const perUnits = parseUsdc(perPayment);
  const payments =
    limitUnits && perUnits && perUnits <= limitUnits ? Number(limitUnits / perUnits) : null;

  return (
    <Page title="New remora" description="Start from a template and set its leash.">
      <PageHeader title="New remora" description="Pick what it does. You can change it later." />

      <div className="flex w-full flex-col gap-6">
        <RadioGroup
          aria-label="Template"
          value={slug}
          onValueChange={setSlug}
          className="ob-card-grid"
        >
          {list.map(([s, t]) => {
            const spends = Boolean(t.budgetSuggestion.perPaymentUsd);
            return (
              <FieldLabel
                key={s}
                htmlFor={`template-${s}`}
                className="ob-gallery-card w-full cursor-pointer items-start gap-3 font-normal has-data-[state=checked]:border-ob-focus has-data-[state=checked]:bg-ob-control-hover dark:has-data-[state=checked]:bg-ob-control-hover"
              >
                <RadioGroupItem id={`template-${s}`} value={s} className="mt-0.5" />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ob-text">{t.name}</span>
                    {spends ? (
                      <Package aria-hidden className="size-4 text-ob-muted" />
                    ) : (
                      <Shield aria-hidden className="size-4 text-ob-muted" />
                    )}
                    <Badge variant={spends ? "accent" : "secondary"}>
                      {spends ? "Spends USDC" : "Read-only"}
                    </Badge>
                  </div>
                  <p className="text-md text-ob-secondary">{t.summary}</p>
                </div>
              </FieldLabel>
            );
          })}
        </RadioGroup>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <Field>
              <FieldLabel htmlFor="remora-name">Name</FieldLabel>
              <Input
                id="remora-name"
                placeholder={chosen?.name ?? "Name"}
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>

            {slug === "scout" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="monthly">Monthly limit (USDC)</FieldLabel>
                    <Input
                      id="monthly"
                      inputMode="decimal"
                      value={monthly}
                      onChange={(e) => setMonthly(e.target.value)}
                    />
                    <FieldDescription>
                      Sui won't let it spend more than this a month.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="per-payment">Most it pays at once (USDC)</FieldLabel>
                    <Input
                      id="per-payment"
                      inputMode="decimal"
                      value={perPayment}
                      onChange={(e) => setPerPayment(e.target.value)}
                    />
                    <FieldDescription>Anything above this asks you first.</FieldDescription>
                  </Field>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="flex items-center gap-1 text-md font-medium">
                    It can pay only these
                    <Hint label="About what it can pay">
                      Sui enforces this budget onchain, not us. It pays only these services;
                      anything over the per-payment cap asks you first.
                    </Hint>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(chosen?.payees ?? []).map((payee) => (
                      <Badge key={payee} variant="outline" title={payee}>
                        {payeeName(payee)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <Field>
                <FieldLabel htmlFor="watch">Addresses to watch</FieldLabel>
                <Textarea
                  id="watch"
                  rows={3}
                  value={watch}
                  onChange={(e) => setWatch(e.target.value)}
                />
                <FieldDescription>One per line. It only reads; it never pays.</FieldDescription>
              </Field>
            )}
          </div>

          <aside aria-label="Summary" className="flex flex-col gap-3 lg:sticky lg:top-6">
            <h2 className="ob-section-title">Summary</h2>
            <PropertyList>
              <Property term="Template">
                <span className="block truncate">{chosen?.name ?? "—"}</span>
              </Property>
              <Property term="Name">
                <span className="block truncate">{name.trim() || chosen?.name || "—"}</span>
              </Property>
              {slug === "scout" ? (
                <>
                  <Property term="Monthly limit">{monthly || "—"} USDC</Property>
                  <Property term="Most at once">{perPayment || "—"} USDC</Property>
                  <Property term="At the cap">
                    {payments === null ? "—" : `${payments} payments a month`}
                  </Property>
                  <Property term="Can pay">{(chosen?.payees ?? []).length} sources</Property>
                </>
              ) : (
                <Property term="Budget">None, read-only</Property>
              )}
            </PropertyList>
            {slug === "scout" ? <Badge variant="secondary">Enforced on Sui</Badge> : null}
            <p className="rounded-ob-lg bg-ob-control-hover px-3 py-2.5 text-md text-ob-secondary">
              {slug === "scout" ? (
                <>
                  You'll sign <strong>1 transaction</strong> to set its spending limit.
                </>
              ) : (
                <>No signature needed. A Wallet watcher only reads.</>
              )}
            </p>

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Couldn't create it</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              type="button"
              className="w-full"
              disabled={busy || !list.length}
              onClick={() => void create()}
              data-testid="create-step"
            >
              {busy ? <Spinner /> : null}
              {busy ? STEP_TEXT[step] : `Create ${chosen?.name ?? "remora"}`}
            </Button>
          </aside>
        </div>
      </div>
    </Page>
  );
}

export function NewRemoraPage() {
  return (
    <RequireOwner what="the create wizard" needsWallet>
      {(owner) => <Wizard owner={owner} />}
    </RequireOwner>
  );
}
