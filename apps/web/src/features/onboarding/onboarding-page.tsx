import { useCurrentAccount } from "@mysten/dapp-kit";
import { Check } from "lucide-react";
import { Link } from "react-router";
import { useShellTitle } from "@/app/shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/features/remoras/api";
import { useLoad, useOwner } from "@/features/remoras/hooks";

const STEPS = [
  {
    id: "sign-in",
    title: "Sign in with your wallet",
    body: "Your wallet owns your remoras' memory and money.",
  },
  {
    id: "memory",
    title: "Your remoras' memory",
    body: "Each remora keeps its memory in Walrus Memory, under namespaces tied to your address. Browse it any time.",
    to: "/memory",
  },
  {
    id: "fund",
    title: "Fund your address balance",
    body: "Remoras spend USDC from your address balance, only through their Disc.",
    to: "/funds",
  },
  {
    id: "telegram",
    title: "Link Telegram",
    body: "Talk to your remoras where you already are.",
    to: "/settings",
  },
  {
    id: "first",
    title: "Your first remora",
    body: "Start from a template: Scout buys answers, Sentinel watches wallets.",
    to: "/remoras/new",
  },
] as const;

/** `/onboarding` (A6): the five steps, each ticked from live state where we can tell. */
export function OnboardingPage() {
  useShellTitle("Get started");
  const account = useCurrentAccount();
  const { owner } = useOwner();
  const remoras = useLoad(
    () => (owner ? api.remoras() : Promise.resolve({ ok: true as const, data: { remoras: [] } })),
    [owner],
  );
  const doneOf = (id: string) =>
    id === "sign-in"
      ? Boolean(account && owner)
      : id === "memory"
        ? Boolean(owner)
        : id === "first"
          ? (remoras.data?.remoras.length ?? 0) > 0
          : false;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 overflow-y-auto p-4">
      {STEPS.map((s, i) => {
        const done = doneOf(s.id);
        return (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex size-6 items-center justify-center rounded-full border text-xs">
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                {s.title}
                {done ? <Badge variant="secondary">done</Badge> : null}
              </CardTitle>
              <CardDescription>
                {s.body}{" "}
                {"to" in s ? (
                  <Link className="underline" to={s.to}>
                    Open
                  </Link>
                ) : null}
              </CardDescription>
            </CardHeader>
          </Card>
        );
      })}
    </div>
  );
}
