/**
 * `/verify/:ref` (G3·ui): anyone with a transaction digest or a Wake id can check a remora's receipt
 * against the chain: the intent hash, the `Paid` anchor, the payee's balance change, and who signed.
 * No sign-in needed: it only reads public chain data and the stored Wake.
 */
import type { VerifyResult } from "@remora/schema";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/features/remoras/api";
import { WakeDetails } from "@/features/remoras/why-drawer";
import { ShareControl } from "./share-control";
import { useOwnsWake } from "./use-owns-wake";
import { CheckList, VerifyVerdict } from "./verify-result";

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
  const owns = useOwnsWake(r?.wake.agent);

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
          <VerifyVerdict checks={r.checks} anchored={r.anchored} />

          <Section title="What we checked">
            <CheckList checks={r.checks} />
          </Section>

          {owns && r ? (
            <Section title="Share this proof">
              <ShareControl wakeId={r.receiptId} />
            </Section>
          ) : null}

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
