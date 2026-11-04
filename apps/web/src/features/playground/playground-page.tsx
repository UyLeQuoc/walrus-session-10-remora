/**
 * `/playground` (H7·ui, ADR-0051): try Scout without a wallet. A visitor gets their own Scout with a
 * $1 Disc the playground wallet funds: a few questions, a limited time. The Disc caps the worst
 * case onchain; every answer has its receipt (Why?/verify). "Get your own" leads to sign-in.
 */
import { type PlaygroundSession, PlaygroundSession as SessionSchema } from "@remora/schema";
import {
  Bot,
  Clock,
  FileText,
  Fish,
  type LucideIcon,
  MessageCircleQuestion,
  Package,
  ReceiptText,
  Send,
  Shield,
  Sparkles,
  Store,
  Trophy,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { z } from "zod";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Hash } from "@/components/hash";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Flow, Meter, Receipt, Stat, Steps } from "@/components/visual";
import { Markdown } from "@/features/chat/markdown";
import { useReefServices } from "@/features/reef/hooks";
import { apiFetch, errorMessage } from "@/lib/api";
import { payeeName } from "@/lib/payee";
import { explorerTx, usdc } from "@/lib/usdc";
import { cn } from "@/lib/utils";

const TOKEN_KEY = "remora.playground";
const Availability = z.object({
  open: z.boolean(),
  reason: z.string().nullable(),
  limits: SessionSchema.shape.limits,
  network: z.string(),
});

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function storeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private browsing: the httpOnly cookie still carries the session.
  }
}

async function call<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}) {
  const token = readToken();
  const res = await apiFetch(path, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(token ? { "x-remora-playground": token } : {}),
    },
  });
  if (!res.ok) throw new Error(await errorMessage(res, "The playground didn't answer."));
  return schema.parse(await res.json());
}

/** A session's length in words: minutes under two hours, hours after. */
export const lasts = (minutes: number) =>
  minutes < 120 ? `${minutes} minutes` : `${Math.round(minutes / 60)} hours`;

/**
 * ADR-0105: one question per paid service, and one it answers without paying, each run once on
 * testnet (examples.spec.ts). A card names what it uses and, once the Reef has answered, its price.
 */
export const SUGGESTIONS: ReadonlyArray<{
  text: string;
  service: string | null;
  icon: LucideIcon;
}> = [
  { text: "Is package 0x2 safe to depend on?", service: "sui-risk", icon: Package },
  { text: "What are the odds for tonight's match?", service: "odds", icon: Trophy },
  { text: "Summarize https://docs.wal.app in three lines", service: "brief", icon: FileText },
  { text: "What does a Sui upgrade cap do?", service: null, icon: Sparkles },
];

/** The cards under the question box: click one to fill the box. */
function SuggestionCards({ current, onPick }: { current: string; onPick: (text: string) => void }) {
  const reef = useReefServices();
  const price = (service: string) => reef.data?.find((x) => x.name === service)?.priceUsdc;
  return (
    <ul className="grid gap-2 sm:grid-cols-2" aria-label="Questions to try">
      {SUGGESTIONS.map((q) => {
        const p = q.service ? price(q.service) : undefined;
        return (
          <li key={q.text} className="flex">
            <button
              type="button"
              aria-pressed={q.text === current}
              className={cn(
                "flex w-full items-start gap-3 rounded-ob-card border border-ob-border p-3 text-left transition-colors hover:bg-ob-control",
                q.text === current && "border-ob-accent bg-ob-accent-soft/40",
              )}
              onClick={() => onPick(q.text)}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-ob-md [&_svg]:size-4",
                  q.service
                    ? "bg-ob-accent-soft text-ob-accent-text"
                    : "bg-ob-success-soft text-ob-success-text",
                )}
                aria-hidden
              >
                <q.icon />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs text-ob-muted">
                  {q.service ? payeeName(`reef:${q.service}`) : "No purchase needed"}
                  {p ? <span className="tabular-nums"> · {usdc(p)} USDC</span> : null}
                </span>
                <span className="text-sm text-ob-text">{q.text}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function PlaygroundPage() {
  const [session, setSession] = useState<PlaygroundSession | null>(null);
  const [open, setOpen] = useState<z.infer<typeof Availability> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [question, setQuestion] = useState(SUGGESTIONS[0]?.text ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (readToken()) {
        const s = await call("/api/playground/session", z.object({ session: SessionSchema })).catch(
          () => null,
        );
        if (s) setSession(s.session);
        else storeToken(null);
      }
      setOpen(await call("/api/playground", Availability));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void load(), [load]);

  const start = async () => {
    setError("");
    setBusy("Setting your Researcher's 1 USDC spending limit onchain…");
    try {
      const out = await call(
        "/api/playground/session",
        z.object({ session: SessionSchema, token: z.string() }),
        { method: "POST" },
      );
      storeToken(out.token);
      setSession(out.session);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  };
  const ask = async () => {
    setError("");
    setBusy("Your Researcher is thinking; it may buy data first…");
    try {
      const out = await call("/api/playground/ask", z.object({ session: SessionSchema }), {
        method: "POST",
        body: JSON.stringify({ question }),
      });
      setSession(out.session);
      setQuestion("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  };

  const spent = session ? Number(session.spentUsdc) : 0;
  const budget = session ? Number(session.budgetUsdc) : 1;
  const ended = session && session.status !== "live";
  const answered = (session?.answers.length ?? 0) > 0;
  const step = !session ? 0 : !answered ? 1 : 3;
  const limitUsdc = open?.limits.discUsdc ?? "1.00";

  return (
    <Page
      title="Try a Researcher"
      description="Try a Researcher with a 1 USDC limit. No wallet needed."
    >
      <PageHeader
        title="Try a Researcher"
        description="Your own Researcher with a 1 USDC limit. No wallet needed."
        hint="Sui enforces the limit onchain, so it can't spend more. Each answer that paid has a receipt: the onchain record of what it paid, which anyone can check."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/remoras/new">Get your own</Link>
          </Button>
        }
      />
      <Steps
        label="Try a Researcher"
        current={step}
        className="max-w-3xl"
        steps={[
          { label: "Start" },
          { label: "Ask" },
          { label: "It pays" },
          { label: "Check the receipt" },
        ]}
      />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {loading ? <Skeleton className="h-40 w-full max-w-3xl" /> : null}

      {!loading && !session ? (
        <div className="flex max-w-3xl flex-col gap-5" data-testid="playground-intro">
          <Flow
            label="What happens"
            nodes={[
              {
                id: "limit",
                label: "Spending limit",
                icon: <Shield />,
                sub: `${limitUsdc} USDC, onchain`,
                tone: "accent",
              },
              { id: "remora", label: "Your Researcher", icon: <Bot />, sub: "answers" },
              { id: "svc", label: "Paid service", icon: <Store />, sub: "e.g. 0.01 USDC" },
              {
                id: "receipt",
                label: "Receipt",
                icon: <ReceiptText />,
                sub: "anyone can check",
                tone: "success",
              },
            ]}
            active={1}
          />
          <div className="grid grid-cols-3 gap-3 rounded-xl border border-ob-border bg-ob-raised p-4">
            <Stat size="sm" label="Limit" icon={<Shield />} value={limitUsdc} unit="USDC" />
            <Stat
              size="sm"
              label="Questions"
              icon={<MessageCircleQuestion />}
              value={open?.limits.questionsPerSession ?? 3}
            />
            <Stat
              size="sm"
              label="Lasts"
              icon={<Clock />}
              value={lasts(open?.limits.ttlMinutes ?? 1440)}
            />
          </div>
          {open && !open.open ? (
            <Alert variant="warning">
              <AlertTitle>Not right now</AlertTitle>
              <AlertDescription>
                {open.reason}{" "}
                <span className="text-ob-muted">
                  Try again later, or{" "}
                  <Link className="link" to="/remoras/new">
                    get your own Researcher
                  </Link>
                  .
                </span>
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="lg"
              disabled={!!busy || !open?.open}
              onClick={() => void start()}
            >
              <Fish /> Start my Researcher
            </Button>
            {busy ? (
              <span className="flex items-center gap-2 text-ob-muted">
                <Spinner /> {busy}
              </span>
            ) : (
              <span className="text-xs text-ob-muted">
                Not kept in memory. Its limit is revoked at the end.
              </span>
            )}
          </div>
        </div>
      ) : null}

      {session ? (
        <>
          <Section
            title={session.name}
            badge={
              <Badge variant={ended ? "outline" : "success"}>{ended ? "ended" : "live"}</Badge>
            }
            description={ended ? "Session over: its spending limit is revoked onchain." : undefined}
          >
            <div
              className="grid max-w-3xl gap-4 rounded-ob-card border border-ob-border-grouped bg-ob-grouped p-4 sm:grid-cols-[1fr_auto]"
              data-testid="playground-status"
            >
              <Meter
                value={spent}
                max={budget}
                label="Spent of the budget"
                left={
                  <span data-testid="playground-spent">
                    {session.spentUsdc} of {session.budgetUsdc} USDC
                  </span>
                }
                right={
                  ended
                    ? "limit revoked"
                    : `ends ${new Date(session.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                }
              />
              <Stat
                size="sm"
                label="Questions left"
                value={<span data-testid="playground-questions">{session.questionsLeft}</span>}
              />
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ob-muted sm:col-span-2">
                {session.discId ? <Hash value={session.discId} label="Spending limit" /> : null}
                {session.issueDigest ? (
                  <Hash
                    value={session.issueDigest}
                    href={explorerTx(session.network, session.issueDigest)}
                    label="issued in"
                  />
                ) : null}
                {session.revokeDigest ? (
                  <Hash
                    value={session.revokeDigest}
                    href={explorerTx(session.network, session.revokeDigest)}
                    label="revoked in"
                  />
                ) : null}
              </div>
            </div>
          </Section>

          <Section title="Ask">
            <div className="flex max-w-3xl flex-col gap-3">
              <ul className="flex flex-col gap-3" aria-label="Answers">
                {session.answers.map((a) => (
                  <li
                    key={a.eventId}
                    className="flex flex-col gap-3 rounded-ob-card border border-ob-border-grouped bg-ob-grouped p-4 text-md"
                    data-testid="playground-answer"
                  >
                    <p className="font-medium" data-ux-skip>
                      {a.question}
                    </p>
                    <Markdown>{a.answer}</Markdown>
                    <div className="flex flex-wrap items-end gap-3">
                      {a.paid.map((p) => (
                        <Receipt
                          key={`${p.payee}${p.digest}`}
                          compact
                          amount={p.amountUsdc}
                          payee={payeeName(p.payee)}
                          verified={undefined}
                          data-testid="playground-paid"
                          proof={
                            p.digest ? (
                              <Hash
                                value={p.digest}
                                href={explorerTx(session.network, p.digest)}
                                label="paid in"
                              />
                            ) : undefined
                          }
                        />
                      ))}
                      {a.verify ? (
                        <Button asChild variant="outline" size="sm">
                          <Link to={a.paid[0]?.digest ? `/verify/${a.paid[0].digest}` : a.verify}>
                            <ReceiptText /> Why? Check its receipt
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              {!ended && session.questionsLeft > 0 ? (
                <div className="flex flex-col gap-3">
                  <Textarea
                    aria-label="Your question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    rows={2}
                  />
                  <SuggestionCards current={question} onPick={setQuestion} />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      disabled={!!busy || !question.trim()}
                      onClick={() => void ask()}
                    >
                      <Send /> Ask Researcher
                    </Button>
                    {busy ? (
                      <span className="flex items-center gap-3 text-md text-ob-muted">
                        <Spinner /> {busy}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertTitle>{ended ? "Session over" : "That was your last question"}</AlertTitle>
                  <AlertDescription>
                    Want one that remembers and learns?{" "}
                    <Link className="link" to="/remoras/new">
                      Get your own
                    </Link>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </Section>
        </>
      ) : null}
    </Page>
  );
}
