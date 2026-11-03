/**
 * `/verify/:ref` (G3·ui): anyone with a transaction digest or a Wake id can check a remora's receipt
 * against the chain: the intent hash, the `Paid` anchor, the payee's balance change, and who signed.
 * No sign-in needed: it only reads public chain data and the stored Wake.
 */
import type { FeedItem, VerifyResult } from "@remora/schema";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Time } from "@/components/app/time";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Amount, Checks } from "@/components/visual";
import { api } from "@/features/remoras/api";
import { useLoad, useOwner } from "@/features/remoras/hooks";
import { WakeDetails } from "@/features/remoras/why-drawer";
import { payeeName } from "@/lib/payee";
import { ShareControl } from "./share-control";
import { useOwnsWake } from "./use-owns-wake";
import { CheckList, VerifyVerdict } from "./verify-result";

/** What a check confirms, shown before one runs as the same list that lights up after. */
const CHECKS = [
  { label: "It did what it said", detail: "What it said it would do matches what it did." },
  { label: "The payment is onchain", detail: "In the transaction you pasted." },
  { label: "The payee got the amount", detail: "Its balance moved by exactly that much." },
  { label: "Its own key signed", detail: "The remora's key, not a stranger's." },
];

/** Signed in: your latest paid answers, one click from their check (ADR-0103). */
function RecentReceipts() {
  const { owner } = useOwner();
  const feed = useLoad(
    () =>
      owner
        ? api.feed({ type: "payment", limit: "5" })
        : Promise.resolve({ ok: true as const, data: { events: [] as FeedItem[] } }),
    [owner],
  );
  const rows = (feed.data?.events ?? []).filter((e) => e.receiptId);
  // Nothing to paste yet (signed out, or no paid answer): one minute in the playground makes one.
  if (!rows.length)
    return feed.loading ? null : (
      <div className="flex max-w-3xl flex-wrap items-center gap-3 rounded-xl border border-dashed border-ob-border px-4 py-3">
        <p className="min-w-0 flex-1 text-sm text-ob-secondary">
          No receipt yet? A Researcher makes one in a minute.
        </p>
        <Button asChild size="sm">
          <Link to="/playground">Try a Researcher</Link>
        </Button>
      </div>
    );
  return (
    <Section title="Your recent receipts">
      <ul className="flex max-w-3xl flex-col gap-2" aria-label="Your recent receipts">
        {rows.map((e) => {
          const p = e.payload as { amount?: string; payee?: string };
          return (
            <li
              key={e.id}
              className="flex items-center gap-3 rounded-lg border border-ob-border bg-ob-raised px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm">
                {p.payee ? payeeName(p.payee) : e.summary}
              </span>
              {p.amount ? <Amount value={p.amount} className="text-sm" /> : null}
              <Time value={e.createdAt} className="text-ob-muted" />
              <Button asChild variant="outline" size="sm">
                <Link to={`/verify/${e.receiptId}`}>Verify</Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

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
        description="Check any receipt against Sui. No sign-in needed."
        hint="Paste a Sui transaction digest or a receipt id. Remora reads the chain and compares; nothing here asks you to take its word."
      />
      <form
        className="flex flex-col gap-2 sm:max-w-2xl sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) navigate(`/verify/${input.trim()}`);
        }}
      >
        <Input
          aria-label="Digest or receipt id"
          className="h-10"
          placeholder="Receipt id or Sui transaction"
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
        <>
          <RecentReceipts />
          <Section title="What we check">
            <Checks
              className="max-w-3xl"
              label="What we check"
              items={CHECKS.map((c) => ({ ...c, state: "pending" as const }))}
            />
          </Section>
        </>
      ) : null}
    </Page>
  );
}
