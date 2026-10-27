/**
 * `/verify/:ref` (G3·ui): anyone with a transaction digest or a Wake id can check a remora's receipt
 * against the chain: the intent hash, the `Paid` anchor, the payee's balance change, and who signed.
 * No sign-in needed: it only reads public chain data and the stored Wake.
 */
import type { VerifyResult } from "@remora/schema";
import { CheckCircle2, CircleMinus, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Page, PageHeader, Section } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/features/remoras/api";
import { WakeDetails } from "@/features/remoras/why-drawer";
import { cn } from "@/lib/utils";

const CHECKS = [
  "The intent hash matches what the remora says it did.",
  "The Paid anchor is on chain, in the transaction you pasted.",
  "The payee's balance moved by the amount in the receipt.",
  "The signer is the remora's key, not a stranger.",
];

export function VerifyPage() {
  const { ref = "" } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(ref);
  const [state, setState] = useState<{
    result: VerifyResult | null;
    error: string;
    loading: boolean;
  }>({
    result: null,
    error: "",
    loading: false,
  });
  useEffect(() => {
    if (!ref) return;
    setState({ result: null, error: "", loading: true });
    void api
      .verify(ref)
      .then((r) =>
        setState(
          r.ok
            ? { result: r.data, error: "", loading: false }
            : { result: null, error: r.error, loading: false },
        ),
      );
  }, [ref]);
  const r = state.result;
  const allOk = r ? r.checks.every((c) => c.ok !== false) : false;

  return (
    <Page title="Verify a receipt" description="Check a remora receipt against Sui.">
      <PageHeader
        title="Verify a receipt"
        description="Paste a transaction digest or a Wake id. We check it against Sui through Tatum; no sign-in needed."
      />
      <form
        className="flex flex-col gap-2 sm:max-w-2xl sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) navigate(`/verify/${input.trim()}`);
        }}
      >
        <Input
          aria-label="Digest or Wake id"
          className="h-10"
          placeholder="Transaction digest or Wake id"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit" size="lg">
          Verify
        </Button>
      </form>

      {state.loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full rounded-ob-card" />
          <Skeleton className="h-32 w-full rounded-ob-card" />
        </div>
      ) : null}
      {state.error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn't check that receipt</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            {state.error}
            <Button variant="outline" size="sm" onClick={() => navigate(`/verify/${ref}`)}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {r ? (
        <>
          <div
            className={cn(
              "flex flex-col gap-1.5 rounded-ob-card border px-5 py-4",
              allOk
                ? "border-ob-success-soft bg-ob-success-soft"
                : "border-ob-danger-soft bg-ob-danger-soft",
            )}
            data-testid="verify-verdict"
          >
            <div className="flex flex-wrap items-center gap-2">
              {allOk ? (
                <CheckCircle2 className="size-5 text-ob-success" />
              ) : (
                <XCircle className="size-5 text-ob-danger" />
              )}
              <p className="text-base font-semibold tracking-tight text-ob-text">
                {allOk ? "Verified" : "Doesn't check out"}
              </p>
              {r.anchored ? (
                <StatusBadge status="verified" />
              ) : (
                <Badge variant="outline">not anchored</Badge>
              )}
            </div>
            <p className="text-md text-ob-secondary">
              {allOk
                ? "The receipt matches the chain."
                : "At least one check did not match. Treat the claim as unproven."}
            </p>
          </div>

          <Section title="What we checked">
            <ul className="ob-group" aria-label="Checks">
              {r.checks.map((c) => (
                <li key={c.name} className="flex items-start gap-3 px-4 py-3 text-md">
                  {c.ok === null ? (
                    <CircleMinus className="mt-0.5 size-4 shrink-0 text-ob-dim" />
                  ) : c.ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ob-success" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-ob-danger" />
                  )}
                  <span className="min-w-0">
                    <span className="font-medium text-ob-text">{c.name}</span>{" "}
                    <span className="break-all text-ob-muted">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Receipt">
            <WakeDetails
              view={{
                wakeBlobId: null,
                intentHash: r.checks[0]?.detail ?? "",
                anchored: r.anchored,
                wake: r.wake,
              }}
            />
          </Section>
        </>
      ) : null}

      {!r && !state.loading && !state.error ? (
        <Section title="What we check" description="Nothing here asks you to take Remora's word.">
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {CHECKS.map((line) => (
              <li
                key={line}
                className="ob-card flex-row items-start gap-3 text-md text-ob-secondary"
              >
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ob-accent-text" />
                {line}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </Page>
  );
}
