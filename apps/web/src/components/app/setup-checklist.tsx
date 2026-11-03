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
import { SettingsGroup, SettingsRow, SettingsSection } from "@/openbot/pages";

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
  // ADR-0103: while the balance or the remoras are unknown (loading, or the server failing), the
  // checklist can't say what's done, so it doesn't show; an unknown is never a "to do".
  const known =
    !ownerLoading &&
    (!owner || (Boolean(funds.data) && Boolean(remoras.data) && !funds.error && !remoras.error));
  return { steps, done, total: required.length, next, ownerLoading, reload, known };
}

function Circle({ done, current, index }: { done: boolean; current: boolean; index: number }) {
  return (
    <span
      aria-hidden
      className="ob-step"
      data-state={done ? "done" : current ? "current" : undefined}
    >
      {done ? <Check /> : index}
    </span>
  );
}

export function SetupChecklist({ variant = "full" }: { variant?: "full" | "compact" }) {
  const { steps, done, total, next, ownerLoading, reload, known } = useSteps();
  const [dismissed, setDismissed] = useState(() => readStored("local", DISMISSED) === "1");

  if (!known) return null;
  if (variant === "compact") {
    if (done === total || dismissed) return null;
    return (
      <div className="flex flex-col gap-2 rounded-ob-lg border border-ob-border-grouped bg-ob-grouped p-3 group-data-[collapsible=icon]:hidden">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-md font-medium">Set up</p>
          <span className="text-xs text-ob-muted tabular-nums">
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
    <SettingsSection
      title="Set up Remora"
      actions={
        <span className="text-md text-ob-muted tabular-nums">
          {done} of {total} done
        </span>
      }
    >
      <Progress value={(done / total) * 100} aria-label={`${done} of ${total} setup steps`} />
      <SettingsGroup as="ol">
        {steps.map((step, i) => {
          const current = !step.done && !step.optional && step.id === next?.id;
          return (
            <SettingsRow
              as="li"
              key={step.id}
              size="compact"
              stack
              className={cn(!step.done && !current && !step.optional && "opacity-60")}
              media={
                step.optional ? (
                  <span aria-hidden className="ob-step">
                    ·
                  </span>
                ) : (
                  <Circle done={step.done} current={current} index={i + 1} />
                )
              }
              title={
                <span className={cn(step.done && "text-ob-muted")}>
                  {step.title}
                  {step.optional ? (
                    <span className="ml-1 text-xs font-normal text-ob-muted">(optional)</span>
                  ) : null}
                </span>
              }
              actions={
                step.done ? null : step.connect ? (
                  <WalletPicker
                    label={ownerLoading ? "Loading…" : "Sign in"}
                    variant="outline"
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
                )
              }
            />
          );
        })}
      </SettingsGroup>
    </SettingsSection>
  );
}
