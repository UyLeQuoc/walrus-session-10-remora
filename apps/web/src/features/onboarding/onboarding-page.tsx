import { useCurrentAccount } from "@mysten/dapp-kit";
import { Check } from "lucide-react";
import { Link } from "react-router";
import { useShellTitle } from "@/app/shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const STEPS = [
  {
    id: "sign-in",
    title: "Sign in with your wallet",
    body: "Your wallet owns your remoras' memory and money.",
  },
  {
    id: "memory",
    title: "Your Walrus Memory account",
    body: "We find yours or create one, then add your remoras as delegates.",
  },
  {
    id: "fund",
    title: "Fund your address balance",
    body: "Remoras spend USDC from your address balance, only through their Disc.",
    to: "/funds",
  },
  { id: "telegram", title: "Link Telegram", body: "Talk to your remoras where you already are." },
  {
    id: "first",
    title: "Your first remora",
    body: "Start from a template: Scout buys answers, Sentinel watches wallets.",
    to: "/remoras",
  },
] as const;

/** `/onboarding` (A6 skeleton): the five steps; sign-in is live, the rest land in W2. */
export function OnboardingPage() {
  useShellTitle("Get started");
  const account = useCurrentAccount();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 overflow-y-auto p-4">
      {STEPS.map((s, i) => {
        const done = s.id === "sign-in" && Boolean(account);
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
