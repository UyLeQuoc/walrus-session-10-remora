/**
 * ADR-0111 (E11): remoras selling to remoras.
 * - `SellCard`: its owner puts its answers on sale (a name, a price, a line). Another owner's remora
 *   pays this owner's address for each answer, and this remora pays its own sources from its own
 *   limit. The card shows what it sold, with the buyers' receipts.
 * - `BuyFromCard`: the other side. Remoras on sale in the Reef, and one signature to let this remora
 *   pay one of them.
 */
import type { RemoraView } from "@remora/schema";
import { Store, UserPlus } from "lucide-react";
import { useState } from "react";
import { Section } from "@/components/app/page";
import { Hash } from "@/components/hash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Empty, Problem, Receipt } from "@/components/visual";
import { useSignAndRun } from "@/features/funds/sign";
import { fetchReefServices } from "@/features/reef/api";
import { payeeName } from "@/lib/payee";
import { explorerTx, parseUsdc, usdc } from "@/lib/usdc";
import { api } from "./api";
import { useLoad } from "./hooks";

const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

export function SellCard({ r, readOnly = false }: { r: RemoraView; readOnly?: boolean }) {
  const view = useLoad(() => api.sale(r.id), [r.id]);
  const v = view.data;
  const [slug, setSlug] = useState("");
  const [price, setPrice] = useState("");
  const [blurb, setBlurb] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (view.error) return <Problem title="Can't load its sale right now." detail={view.error} />;
  if (!v) return null;
  const sale = v.sale;
  const on = !!sale?.on;

  const save = async (next: boolean) => {
    setBusy(true);
    setError("");
    const micro = parseUsdc(price || (sale ? usdc(sale.price) : "0.02"));
    const out = await api.setSale(r.id, {
      on: next,
      slug: slug || sale?.slug || slugOf(r.name),
      ...(micro ? { price: micro.toString() } : {}),
      blurb: blurb || sale?.blurb || "",
    });
    setBusy(false);
    if (!out.ok) return setError(out.error);
    void view.refresh();
  };

  return (
    <Section
      title="Sell its answers"
      hint="Another owner's remora pays your address for each answer. Yours pays its own sources from its own limit, and the buyer pays only once the answer is written."
    >
      <div className="flex flex-col gap-4" data-testid="sell-card">
        <div className="flex flex-wrap items-center gap-2 text-md">
          <Store className="size-4 text-ob-muted" aria-hidden />
          {on && v.listed ? (
            <span data-testid="sell-listed">
              On sale as <b>@{sale?.slug}</b> · {usdc(sale?.price ?? "0")} USDC an answer
            </span>
          ) : (
            <span className="text-ob-secondary">Not on sale.</span>
          )}
          {on ? <Badge variant="secondary">in the Reef</Badge> : null}
          {readOnly ? null : (
            <Button
              type="button"
              size="sm"
              variant={on ? "outline" : "default"}
              className="ml-auto"
              disabled={busy}
              onClick={() => void save(!on)}
            >
              {busy ? <Spinner /> : null} {on ? "Stop selling" : "Sell its answers"}
            </Button>
          )}
        </div>
        {readOnly ? null : (
          <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
            <Input
              aria-label="Its name in the Reef"
              placeholder={`@${sale?.slug ?? slugOf(r.name)}`}
              value={slug}
              onChange={(e) => setSlug(e.target.value.replace(/^@/, "").toLowerCase())}
            />
            <Input
              aria-label="Price per answer, USDC"
              inputMode="decimal"
              placeholder={sale ? usdc(sale.price) : "0.02"}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <Input
              aria-label="One line about it"
              className="sm:col-span-2"
              placeholder={sale?.blurb || "What it's good at, in one line"}
              value={blurb}
              maxLength={140}
              onChange={(e) => setBlurb(e.target.value)}
            />
          </div>
        )}
        {v.url && on ? (
          <p className="text-xs text-ob-muted [overflow-wrap:anywhere]">
            Paid door: <code>{v.url}?q=…</code>
          </p>
        ) : null}
        {error ? <p className="text-md text-ob-danger-text">{error}</p> : null}
        {v.sold.length ? (
          <div className="flex flex-col gap-2" data-testid="sell-sold">
            <p className="text-xs text-ob-muted tabular-nums">
              {v.sold.length} sold · {usdc(v.earned)} USDC earned
            </p>
            <ul className="grid gap-2 sm:grid-cols-2" aria-label="Sales">
              {v.sold.slice(0, 4).map((s, i) => (
                <li key={s.digest ?? i}>
                  <Receipt
                    compact
                    data-testid="sell-receipt"
                    amount={usdc(s.amount)}
                    payee={`You, from ${s.buyer ? `${s.buyer.slice(0, 6)}…` : "a buyer"}`}
                    at={s.at}
                    proof={
                      s.digest ? (
                        <Hash
                          value={s.digest}
                          href={explorerTx(r.network, s.digest)}
                          label="paid in"
                        />
                      ) : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : on ? (
          <Empty title="No sales yet." />
        ) : null}
      </div>
    </Section>
  );
}

/** Remoras on sale this remora may pay, and one signature to add one. */
export function BuyFromCard({ r, onChanged }: { r: RemoraView; onChanged: () => void }) {
  const reef = useLoad(async () => {
    try {
      return { ok: true as const, data: await fetchReefServices() };
    } catch (err) {
      return { ok: false as const, error: (err as Error).message };
    }
  }, [r.id]);
  const run = useSignAndRun();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const payees = r.config.budget?.payees ?? [];
  const sellers = (reef.data ?? []).filter((s) => s.kind === "remora" || s.kind === "community");
  if (!r.config.budget || r.status === "retired") return null;

  const allow = async (ref: string) => {
    setBusy(ref);
    setError("");
    try {
      const next = [...new Set([...payees, ref])];
      const tx = await api.payeesTx(r.id, next);
      if (!tx.ok) throw new Error(tx.error);
      if (!tx.data.transaction) throw new Error("This remora has no spending limit.");
      const digest = await run(tx.data.transaction);
      const done = await api.payeesConfirm(r.id, digest, next);
      if (!done.ok) throw new Error(done.error);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <Section
      title="Buy from other remoras"
      hint={`Ask "@name …" and it pays that remora's owner (or that API) for the answer. One signature lets it pay one, under the same limit.`}
    >
      <div className="flex flex-col gap-2" data-testid="buy-from-card">
        {reef.error ? <Problem title="Can't load the Reef right now." detail={reef.error} /> : null}
        {!reef.data ? null : sellers.length ? (
          <ul className="flex flex-col divide-y divide-ob-border" aria-label="Remoras on sale">
            {sellers.map((s) => {
              const ref = `reef:${s.kind}-${s.name.replace(/^@/, "")}`;
              const allowed = payees.includes(ref);
              return (
                <li key={s.name} className="flex flex-wrap items-center gap-2 py-2 text-md">
                  <span className="font-medium">{payeeName(ref)}</span>
                  {s.kind === "community" ? <Badge variant="outline">API</Badge> : null}
                  <span className="text-ob-muted">
                    {usdc(s.priceUsdc)} USDC{s.description ? ` · ${s.description}` : ""}
                  </span>
                  {allowed ? (
                    <Badge variant="secondary" className="ml-auto">
                      may pay
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="ml-auto"
                      disabled={!!busy}
                      onClick={() => void allow(ref)}
                    >
                      {busy === ref ? <Spinner /> : <UserPlus />} Let it pay
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="No remoras on sale yet." />
        )}
        {error ? <p className="text-md text-ob-danger-text">{error}</p> : null}
      </div>
    </Section>
  );
}
