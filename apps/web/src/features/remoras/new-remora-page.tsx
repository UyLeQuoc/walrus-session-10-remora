/**
 * `/remoras/new` (A6 + B1·ui): pick a template, name it, set its budget or what it watches, sign one
 * transaction for the Disc (Scout) or none (Sentinel), and land on its page while its first run (N13)
 * comes in. Each wait says what it's waiting for (N6).
 */
import type { Template } from "@remora/schema";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useShellTitle } from "@/app/shell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSignAndRun } from "@/features/funds/sign";
import { useNetworks } from "@/features/network/use-networks";
import { formatUsdc, parseUsdc } from "@/lib/usdc";
import { cn } from "@/lib/utils";
import { api } from "./api";
import { RequireOwner, useLoad } from "./hooks";

type Step = "idle" | "creating" | "signing" | "confirming";
const STEP_TEXT: Record<Step, string> = {
  idle: "",
  creating: "Creating its key…",
  signing: "Sign the budget (one transaction) in your wallet…",
  confirming: "Confirming onchain…",
};

function Wizard({ owner }: { owner: string }) {
  const navigate = useNavigate();
  const run = useSignAndRun();
  const { network, networks } = useNetworks();
  const templates = useLoad(() => api.templates(), []);
  const [slug, setSlug] = useState<string>("scout");
  const [name, setName] = useState("");
  const [monthly, setMonthly] = useState("1");
  const [perPayment, setPerPayment] = useState("0.05");
  const [watch, setWatch] = useState(owner);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  const list = Object.entries(templates.data?.templates ?? {}) as [string, Template][];
  const chosen = templates.data?.templates[slug];
  const coinType = networks.find((n) => n.network === network)?.usdcCoinType;

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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 overflow-y-auto p-4">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Template</legend>
        {list.map(([s, t]) => (
          <button
            key={s}
            type="button"
            aria-pressed={slug === s}
            onClick={() => setSlug(s)}
            className={cn("rounded-xl text-left", slug === s && "ring-2 ring-primary")}
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle>{t.name}</CardTitle>
                <CardDescription>{t.summary}</CardDescription>
              </CardHeader>
            </Card>
          </button>
        ))}
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor="remora-name">Name</Label>
        <Input
          id="remora-name"
          placeholder={chosen?.name ?? "Name"}
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      {slug === "scout" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="monthly">Monthly limit (USDC)</Label>
            <Input
              id="monthly"
              inputMode="decimal"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="per-payment">Most it pays at once (USDC)</Label>
            <Input
              id="per-payment"
              inputMode="decimal"
              value={perPayment}
              onChange={(e) => setPerPayment(e.target.value)}
            />
          </div>
          <p className="text-sm text-muted-foreground sm:col-span-2">
            Sui enforces this budget through a Disc, not us. It pays only{" "}
            {(chosen?.payees ?? []).join(", ")}; anything over{" "}
            {parseUsdc(perPayment) ? formatUsdc(parseUsdc(perPayment) as bigint) : "the cap"} USDC
            asks you first.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="watch">Addresses to watch</Label>
          <Textarea id="watch" rows={3} value={watch} onChange={(e) => setWatch(e.target.value)} />
          <p className="text-sm text-muted-foreground">
            Read-only: Sentinel has no budget and never pays.
          </p>
        </div>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          disabled={step !== "idle" || !list.length}
          onClick={() => void create()}
        >
          Create {chosen?.name ?? "remora"}
        </Button>
        <span
          className="text-sm text-muted-foreground"
          aria-live="polite"
          data-testid="create-step"
        >
          {STEP_TEXT[step]}
        </span>
      </div>
    </div>
  );
}

export function NewRemoraPage() {
  useShellTitle("New remora");
  return (
    <RequireOwner what="the create wizard">{(owner) => <Wizard owner={owner} />}</RequireOwner>
  );
}
