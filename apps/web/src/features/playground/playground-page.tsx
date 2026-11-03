/**
 * `/playground` (H7·ui, ADR-0051): try Scout without a wallet. A visitor gets their own Scout with a
 * $1 Disc the playground wallet funds: a few questions, a limited time. The Disc caps the worst
 * case onchain; every answer has its receipt (Why?/verify). "Get your own" leads to sign-in.
 */
import { type PlaygroundSession, PlaygroundSession as SessionSchema } from "@remora/schema";
import { Fish, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { z } from "zod";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Hash } from "@/components/hash";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/features/chat/markdown";
import { apiFetch, errorMessage } from "@/lib/api";
import { payeeName } from "@/lib/payee";
import { explorerTx } from "@/lib/usdc";

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

const SUGGESTIONS = ["Is package 0x2 safe to depend on?", "What are the odds for tonight's match?"];

export function PlaygroundPage() {
  const [session, setSession] = useState<PlaygroundSession | null>(null);
  const [open, setOpen] = useState<z.infer<typeof Availability> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [question, setQuestion] = useState(SUGGESTIONS[0] ?? "");

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
    setBusy("Setting your Researcher's $1 spending limit onchain…");
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

  return (
    <Page
      title="Try a Researcher"
      description="Try a Researcher with a $1 budget. No wallet needed."
    >
      <PageHeader
        title="Try a Researcher"
        description="A Researcher of your own with a $1 budget it can't go over. Sui enforces the limit onchain. A receipt is the onchain record of what each answer paid, and anyone can check it."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/remoras/new">Get your own</Link>
          </Button>
        }
      />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {loading ? <Skeleton className="h-40 w-full max-w-3xl" /> : null}

      {!loading && !session ? (
        <Section title="How it works">
          <div className="flex max-w-3xl flex-col gap-3 text-md" data-testid="playground-intro">
            <ul className="list-disc pl-5 text-ob-muted">
              <li>
                Your Researcher is live at once, with a{" "}
                <b>{open?.limits.discUsdc ?? "1.00"} USDC</b> spending limit on{" "}
                {open?.network ?? "testnet"}.
              </li>
              <li>
                Ask up to <b>{open?.limits.questionsPerSession ?? 3}</b> questions. The session ends
                after {lasts(open?.limits.ttlMinutes ?? 1440)}, and its spending limit is revoked
                onchain.
              </li>
              <li>Questions here are not kept in memory. Sign in for a Researcher that learns.</li>
            </ul>
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
            <div className="flex items-center gap-3">
              <Button type="button" disabled={!!busy || !open?.open} onClick={() => void start()}>
                <Fish /> Start my Researcher
              </Button>
              {busy ? (
                <span className="flex items-center gap-2 text-ob-muted">
                  <Spinner /> {busy}
                </span>
              ) : null}
            </div>
          </div>
        </Section>
      ) : null}

      {session ? (
        <>
          <Section
            title={session.name}
            description={
              ended
                ? "This session has ended; its spending limit is revoked onchain."
                : `Ends ${new Date(session.expiresAt).toLocaleString()}.`
            }
          >
            <div
              className="grid max-w-3xl gap-3 rounded-ob-card border border-ob-border-grouped bg-ob-grouped p-4 text-md sm:grid-cols-2"
              data-testid="playground-status"
            >
              <div className="flex flex-col gap-3">
                <span className="flex items-baseline justify-between">
                  <span className="text-ob-muted">Budget</span>
                  <span className="tabular-nums" data-testid="playground-spent">
                    {session.spentUsdc} of {session.budgetUsdc} USDC
                  </span>
                </span>
                <Progress
                  value={Math.min(100, (spent / budget) * 100)}
                  aria-label="Spent of the budget"
                />
                {session.discId ? <Hash value={session.discId} label="Spending limit" /> : null}
                {session.issueDigest ? (
                  <Hash
                    value={session.issueDigest}
                    href={explorerTx(session.network, session.issueDigest)}
                    label="issued in"
                  />
                ) : null}
              </div>
              <div className="flex flex-col gap-3">
                <span className="flex items-baseline justify-between">
                  <span className="text-ob-muted">Questions left</span>
                  <span className="tabular-nums" data-testid="playground-questions">
                    {session.questionsLeft}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={ended ? "outline" : "secondary"}>{session.status}</Badge>
                  {session.revokeDigest ? (
                    <Hash
                      value={session.revokeDigest}
                      href={explorerTx(session.network, session.revokeDigest)}
                      label="revoked in"
                    />
                  ) : null}
                </span>
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
                    <p className="font-medium">{a.question}</p>
                    <Markdown>{a.answer}</Markdown>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-ob-muted">
                      {a.paid.map((p) => (
                        <Badge key={`${p.payee}${p.digest}`} variant="outline">
                          Paid {p.amountUsdc} USDC to {payeeName(p.payee)}
                        </Badge>
                      ))}
                      {a.verify ? (
                        <Link className="link" to={a.verify}>
                          Why? Check its receipt
                        </Link>
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
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      disabled={!!busy || !question.trim()}
                      onClick={() => void ask()}
                    >
                      <Send /> Ask Researcher
                    </Button>
                    {SUGGESTIONS.filter((s) => s !== question).map((s) => (
                      <Button
                        key={s}
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setQuestion(s)}
                      >
                        {s}
                      </Button>
                    ))}
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
                    Sign in with a wallet for a Researcher of your own. It remembers, learns from
                    your feedback, and spends only within the budget you set.{" "}
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
