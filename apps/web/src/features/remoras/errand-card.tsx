/**
 * ADR-0125 (C3): an Errand pays people. One line ("pay Linh 2 USDC for lunch") pays within its limit
 * with a receipt; over its cap or 3x a person's usual, it asks you first. Its contacts are its Disc's
 * payees: adding someone is one signature.
 */
import type { RemoraView } from "@remora/schema";
import { HandCoins, UserPlus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Section } from "@/components/app/page";
import { Hash } from "@/components/hash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Problem } from "@/components/visual";
import { useSignAndRun } from "@/features/funds/sign";
import { usdc } from "@/lib/usdc";
import { api } from "./api";
import { useLoad } from "./hooks";

export function ErrandCard({ r, onDone }: { r: RemoraView; onDone?: () => void }) {
  const view = useLoad(() => api.contacts(r.id), [r.id]);
  const run = useSignAndRun();
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState<"" | "pay" | "add">("");
  const [last, setLast] = useState<{
    answer: string;
    digest?: string | null;
    approvalId?: string;
  } | null>(null);
  const [error, setError] = useState("");
  if (view.error) return <Problem title="Can't load its contacts." detail={view.error} />;
  const contacts = view.data?.contacts ?? [];
  const readOnly = r.status === "retired";

  const pay = async () => {
    if (!text.trim()) return;
    setBusy("pay");
    setError("");
    const out = await api.pay(r.id, text.trim());
    setBusy("");
    if (!out.ok) return setError(out.error);
    setLast(out.data);
    setText("");
    void view.refresh();
    onDone?.();
  };

  const add = async () => {
    setBusy("add");
    setError("");
    try {
      const next = [
        ...contacts.map((c) => ({ name: c.name, address: c.address })),
        { name: name.trim(), address: address.trim() },
      ];
      const tx = await api.contactsTx(r.id, next);
      if (!tx.ok || !tx.data.transaction) throw new Error(tx.ok ? "Nothing to sign." : tx.error);
      const digest = await run(tx.data.transaction);
      const done = await api.contactsConfirm(r.id, digest, next);
      if (!done.ok) throw new Error(done.error);
      setName("");
      setAddress("");
      void view.refresh();
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <Section
      title="Pay someone"
      hint="It pays only the people below, within its limit, with a memo on each receipt. Over its cap, or 3x what someone usually gets, it asks you first."
    >
      <div className="flex flex-col gap-4" data-testid="errand-card">
        {readOnly ? null : (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void pay();
            }}
          >
            <Input
              aria-label="Who and how much"
              placeholder={`pay ${contacts[0]?.name ?? "Linh"} 2 USDC for lunch`}
              value={text}
              className="min-w-0 flex-1"
              onChange={(e) => setText(e.target.value)}
            />
            <Button type="submit" disabled={busy !== "" || !text.trim()} data-testid="errand-pay">
              {busy === "pay" ? <Spinner /> : <HandCoins className="size-4" aria-hidden />} Pay
            </Button>
          </form>
        )}
        {last ? (
          <div
            className="flex flex-col gap-1 rounded-lg bg-ob-surface-2 p-3 text-md"
            data-testid="errand-answer"
          >
            <span>{last.answer}</span>
            {last.digest ? <Hash value={last.digest} label="receipt" /> : null}
            {last.approvalId ? (
              <Link to="/approvals" className="text-sm text-ob-accent-text hover:underline">
                Review it in Approvals
              </Link>
            ) : null}
          </div>
        ) : null}
        <ul className="flex flex-col gap-1" aria-label="Who it may pay">
          {contacts.map((c) => (
            <li
              key={c.ref}
              className="flex flex-wrap items-center gap-2 text-sm"
              data-testid="errand-contact"
            >
              <b>{c.name}</b>
              <Hash value={c.address} label="address" />
              <span className="text-ob-muted">
                {c.usual ? `usually ${usdc(c.usual)} USDC` : "not paid yet"}
              </span>
            </li>
          ))}
        </ul>
        {readOnly ? null : (
          <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
            <Input
              aria-label="Their name"
              placeholder="Name"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              aria-label="Their Sui address"
              placeholder="0x…"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={
                busy !== "" || !name.trim() || !/^0x[0-9a-fA-F]{1,64}$/.test(address.trim())
              }
              onClick={() => void add()}
              data-testid="errand-add"
            >
              {busy === "add" ? <Spinner /> : <UserPlus className="size-4" aria-hidden />} Add · one
              signature
            </Button>
          </div>
        )}
        {error ? <p className="text-md text-ob-danger-text">{error}</p> : null}
      </div>
    </Section>
  );
}
