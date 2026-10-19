/**
 * A6 / C2: the same setup checklist on Home, /onboarding and the sidebar footer, ticked from live
 * state. The three required steps are real; Telegram is optional until the API reports a linked
 * account (handoff to Uy).
 */
import { Check, Plus, Wallet, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { WalletPicker } from "@/components/wallet-picker";
import { useFunds } from "@/features/funds/use-funds";
import { api } from "@/features/remoras/api";
import { useLoad, useOwner } from "@/features/remoras/hooks";
import { useNetwork } from "@/lib/network";
import { readStored, writeStored } from "@/lib/storage";
import { cn } from "@/lib/utils";

const DISMISSED = "remora.setup-dismissed";

type Step = {
  id: string;
  title: string;
  done: boolean;
  optional?: boolean;
  cta?: { label: string; to: string };
  connect?: boolean;
};

function useSteps() {
  const { owner, loading: ownerLoading, reload } = useOwner();
  const network = useNetwork();
  const funds = useFunds(owner, network);
  const remoras = useLoad(
    () =>
      owner
        ? api.remoras()
        : Promise.resolve({ ok: true as const, data: { remoras: [] as never[] } }),
    [owner],
  );
  const ready = BigInt(funds.data?.splits.find((s) => s.role === "owner")?.addressBalance ?? "0");
  const steps: Step[] = [
    {
      id: "wallet",
      title: "Connect your wallet",
      done: Boolean(owner),
      connect: !owner,
    },
    {
      id: "funds",
      title: "Add USDC",
      done: ready > 0n,
      cta: { label: "Add funds", to: "/funds" },
    },
    {
      id: "remora",
      title: "Create your first remora",
      done: (remoras.data?.remoras.length ?? 0) > 0,
      cta: { label: "Create a remora", to: "/remoras/new" },
    },
    {
      id: "telegram",
      title: "Link Telegram",
      done: false,
      optional: true,
      cta: { label: "Link Telegram", to: "/settings" },
    },
  ];
  const required = steps.filter((s) => !s.optional);
  const done = required.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done) ?? null;
  return { steps, done, total: required.length, next, ownerLoading, reload };
}

function Circle({ done, current }: { done: boolean; current: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
        done && "border-success/40 bg-success/15 text-success",
        current && "border-primary bg-primary/10 text-primary",
      )}
    >
      {done ? <Check className="size-3.5" /> : null}
    </span>
  );
}

export function SetupChecklist({ variant = "full" }: { variant?: "full" | "compact" }) {
  const { steps, done, total, next, ownerLoading, reload } = useSteps();
  const [dismissed, setDismissed] = useState(() => readStored("local", DISMISSED) === "1");

  if (variant === "compact") {
    if (done === total || dismissed) return null;
    return (
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 group-data-[collapsible=icon]:hidden">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-sm font-medium">Set up</p>
          <span className="text-xs text-muted-foreground tabular-nums">
            {done}/{total}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Hide setup"
            onClick={() => {
              writeStored("local", DISMISSED, "1");
              setDismissed(true);
            }}
          >
            <X />
          </Button>
        </div>
        <Progress value={(done / total) * 100} aria-label={`${done} of ${total} setup steps`} />
        {next ? (
          <Link
            to={next.connect ? "/onboarding" : (next.cta?.to ?? "/onboarding")}
            className="link text-xs"
          >
            Next: {next.title}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Set up Remora</h2>
        <p className="text-sm text-muted-foreground">
          {done} of {total} done
        </p>
      </div>
      <Progress value={(done / total) * 100} aria-label={`${done} of ${total} setup steps`} />
      <ol className="flex flex-col gap-2">
        {steps.map((step) => {
          const current = !step.done && !step.optional && step.id === next?.id;
          return (
            <li
              key={step.id}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-lg border border-transparent p-2",
                current && "border-primary/40 bg-primary/5",
                !step.done && !current && !step.optional && "opacity-60",
              )}
            >
              <Circle done={step.done} current={current} />
              <span
                className={cn(
                  "min-w-0 flex-1 text-sm",
                  step.done && "text-muted-foreground",
                  current && "font-medium",
                )}
              >
                {step.title}
                {step.optional ? (
                  <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                ) : null}
              </span>
              {step.done ? null : step.connect ? (
                <WalletPicker
                  label={ownerLoading ? "Loading…" : "Connect wallet"}
                  size="sm"
                  signIn
                  onSignedIn={reload}
                />
              ) : current ? (
                <Button asChild size="sm">
                  <Link to={step.cta?.to ?? "/onboarding"}>
                    {step.id === "remora" ? <Plus /> : <Wallet />}
                    {step.cta?.label}
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link to={step.cta?.to ?? "/onboarding"}>{step.cta?.label}</Link>
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
