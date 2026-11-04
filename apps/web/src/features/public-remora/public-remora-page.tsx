/**
 * M9 (ADR-0126): a remora on sale, for anyone. No sign-in: a visitor connects a testnet wallet, asks
 * one question and pays the listed price from their own wallet. The payment is a plain x402 `exact`
 * USDC transfer to the owner's address, gas sponsored by our facilitator, and it settles only after
 * the answer is written, so a failed answer costs nothing.
 */
import { useCurrentAccount, useSignTransaction, useSuiClient } from "@mysten/dapp-kit";
import { coinWithBalance, Transaction } from "@mysten/sui/transactions";
import { toBase64 } from "@mysten/sui/utils";
import {
  decodeHeader,
  encodeHeader,
  PAYMENT_HEADER,
  PAYMENT_RESPONSE_HEADER,
  type PaymentRequired,
  type SettleResponse,
  X402_VERSION,
} from "@remora/disc-sdk";
import { MessageCircleQuestion, ReceiptText, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { z } from "zod";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Time } from "@/components/app/time";
import { Hash } from "@/components/hash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Empty, Problem } from "@/components/visual";
import { WalletPicker } from "@/components/wallet-picker";
import { apiFetch, errorMessage } from "@/lib/api";
import { kindName } from "@/lib/kind";
import { payeeName } from "@/lib/payee";
import { usdc } from "@/lib/usdc";

const PublicRemora = z.object({
  slug: z.string(),
  name: z.string(),
  template: z.string(),
  blurb: z.string(),
  price: z.string(),
  payTo: z.string(),
  network: z.string(),
  path: z.string(),
  answered: z.number(),
  sold: z.array(
    z.object({
      at: z.string(),
      amount: z.string(),
      digest: z.string().nullable(),
      buyer: z.string(),
    }),
  ),
});
type PublicRemora = z.infer<typeof PublicRemora>;

const Answer = z.object({
  answer: z.string(),
  paid: z
    .array(z.object({ payee: z.string(), amount: z.string(), digest: z.string().nullable() }))
    .optional(),
});

type Step = "" | "quote" | "build" | "gas" | "sign" | "answer";
const STEP_LABEL: Record<Exclude<Step, "">, string> = {
  quote: "Asking its price…",
  build: "Building your payment…",
  gas: "Getting gas sponsored…",
  sign: "Sign in your wallet…",
  answer: "It's answering; you pay once it has…",
};

/** One question, paid from the visitor's wallet: 402 → sponsored transfer → signed → answered. */
function useAskAndPay(slug: string) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: sign } = useSignTransaction();
  const [step, setStep] = useState<Step>("");
  return {
    step,
    async ask(question: string) {
      if (!account) throw new Error("Connect a wallet first.");
      const url = `/api/x402/r/${encodeURIComponent(slug)}?q=${encodeURIComponent(question)}`;
      try {
        setStep("quote");
        const first = await apiFetch(url);
        if (first.status !== 402) throw new Error(await errorMessage(first, "It isn't for sale."));
        const required = (await first.json()) as PaymentRequired;
        const req = required.accepts.find((a) => a.network === "sui:testnet");
        if (!req) throw new Error("It isn't paid on testnet.");
        setStep("build");
        const tx = new Transaction();
        tx.setSender(account.address);
        tx.moveCall({
          target: "0x2::coin::send_funds",
          typeArguments: [req.asset],
          arguments: [
            coinWithBalance({ type: req.asset, balance: BigInt(req.amount) }),
            tx.pure.address(req.payTo),
          ],
        });
        const kind = await tx.build({ client: client as never, onlyTransactionKind: true });
        setStep("gas");
        // Our public gas station; the 402's own one is the facilitator on the server's host.
        const gas = await apiFetch("/api/facilitator/gas", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            network: req.network,
            sender: account.address,
            transactionKind: toBase64(kind),
          }),
        });
        const sponsored = (await gas.json()) as {
          transaction?: string;
          error?: { message?: string };
        };
        if (!gas.ok || !sponsored.transaction)
          throw new Error(sponsored.error?.message ?? "No sponsored gas right now.");
        setStep("sign");
        const signed = await sign({
          transaction: Transaction.from(sponsored.transaction) as never,
        });
        setStep("answer");
        const paid = await apiFetch(url, {
          headers: {
            [PAYMENT_HEADER]: encodeHeader({
              x402Version: X402_VERSION,
              scheme: "exact",
              network: req.network,
              payload: { signature: signed.signature, transaction: signed.bytes },
            }),
          },
        });
        if (!paid.ok)
          throw new Error(await errorMessage(paid, "It couldn't answer, so nothing was charged."));
        const header = paid.headers.get(PAYMENT_RESPONSE_HEADER);
        const settle = header ? decodeHeader<SettleResponse>(header) : null;
        const body = Answer.parse(await paid.json());
        return { ...body, digest: settle?.transaction ?? null, amount: req.amount };
      } finally {
        setStep("");
      }
    },
  };
}

export function PublicRemoraPage() {
  const { slug = "" } = useParams();
  const account = useCurrentAccount();
  const [info, setInfo] = useState<PublicRemora | null>(null);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<{
    answer: string;
    digest: string | null;
    amount: string;
    paid?: { payee: string; amount: string; digest: string | null }[];
  } | null>(null);
  const [askError, setAskError] = useState("");
  const { step, ask } = useAskAndPay(slug);

  useEffect(() => {
    let live = true;
    void apiFetch(`/api/public/r/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await errorMessage(res, "Not found."));
        const parsed = PublicRemora.safeParse(await res.json());
        if (!parsed.success)
          throw new Error("The server answered in a shape this page doesn't know.");
        if (live) setInfo(parsed.data);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [slug]);

  const go = async () => {
    setAskError("");
    setResult(null);
    try {
      setResult(await ask(question.trim()));
    } catch (e) {
      setAskError((e as Error).message);
    }
  };

  if (error) return <Problem title={`No remora sells as @${slug}.`} detail={error} />;
  if (!info)
    return (
      <Page title={`@${slug}`}>
        <Skeleton className="h-40 w-full" />
      </Page>
    );

  return (
    <Page title={`@${info.slug} · Remora`} description={info.blurb}>
      <PageHeader
        title={`@${info.slug}`}
        description={info.blurb || `${info.name}, a ${kindName(info.template)} on sale.`}
      />
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_20rem]">
        <Section
          title="Ask it once"
          hint="You pay its owner's address from your own wallet. No account needed."
        >
          <div className="flex flex-col gap-3" data-testid="public-ask">
            <div className="flex flex-wrap items-center gap-2 text-md">
              <Badge>{usdc(info.price)} USDC an answer</Badge>
              <span className="text-ob-secondary">
                paid to <Hash value={info.payTo} label="owner" />
              </span>
              <Badge variant="outline">{info.network}</Badge>
            </div>
            <Textarea
              aria-label="Your question"
              rows={3}
              maxLength={500}
              placeholder="Is package 0x2 safe to depend on?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            {account ? (
              <Button
                type="button"
                className="self-start"
                disabled={!question.trim() || step !== ""}
                onClick={() => void go()}
                data-testid="public-pay"
              >
                {step ? <Spinner /> : <MessageCircleQuestion className="size-4" aria-hidden />}{" "}
                {step ? STEP_LABEL[step] : `Ask · pay ${usdc(info.price)} USDC`}
              </Button>
            ) : (
              <WalletPicker label="Connect a testnet wallet" className="self-start" />
            )}
            {askError ? <p className="text-md text-ob-danger-text">{askError}</p> : null}
            {result ? (
              <div
                className="flex flex-col gap-2 rounded-lg bg-ob-surface-2 p-4"
                data-testid="public-answer"
              >
                <p className="whitespace-pre-wrap" data-ux-skip>
                  {result.answer}
                </p>
                <p className="flex flex-wrap items-center gap-2 text-sm text-ob-secondary">
                  <ReceiptText className="size-4" aria-hidden /> You paid {usdc(result.amount)} USDC
                  {result.digest ? (
                    <>
                      {" "}
                      <Hash value={result.digest} label="transaction" />
                      <Link
                        to={`/verify/${result.digest}`}
                        className="text-ob-accent-text hover:underline"
                        data-testid="public-verify"
                      >
                        Verify
                      </Link>
                    </>
                  ) : null}
                </p>
                {result.paid?.length ? (
                  <p className="text-xs text-ob-muted">
                    It paid its own sources:{" "}
                    {result.paid.map((p) => `${payeeName(p.payee)} ${usdc(p.amount)}`).join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </Section>
        <Section title="Answers it sold" hint="Every sale is a settled testnet payment.">
          {info.sold.length ? (
            <ul className="flex flex-col gap-2 text-sm" data-testid="public-sold">
              {info.sold.map((s) => (
                <li key={`${s.at}${s.digest}`} className="flex flex-wrap items-center gap-2">
                  <Wallet className="size-3.5 text-ob-muted" aria-hidden />
                  <span className="tabular-nums">{usdc(s.amount)}</span>
                  {s.digest ? <Hash value={s.digest} label="transaction" /> : null}
                  <Time value={s.at} className="text-xs text-ob-muted" />
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No answers sold yet." />
          )}
        </Section>
      </div>
    </Page>
  );
}
