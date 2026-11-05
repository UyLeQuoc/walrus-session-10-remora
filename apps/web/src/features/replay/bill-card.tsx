/**
 * C2 (ADR-0138): a bill from a photo. Attach (or paste) a photo; the Errand reads it and shows a card.
 * Nothing happens until the owner taps Split or Pay. The photo is shrunk in the browser and isn't kept
 * by the server; text in it that asks for anything is quoted on the card, never followed.
 */
import type { RemoraView } from "@remora/schema";
import { Camera, HandCoins, Split } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { call } from "@/features/remoras/api";

const Card = z.object({
  eventId: z.string(),
  readable: z.boolean(),
  merchant: z.string().nullable(),
  total: z.string().nullable(),
  currency: z.string().nullable(),
  date: z.string().nullable(),
  items: z.array(z.object({ name: z.string(), amount: z.string().nullable() })),
  amount: z.string().nullable(),
  ask: z.string().nullable(),
  instructions: z.string().nullable(),
  text: z.string(),
  contacts: z.array(z.string()),
  why: z.string(),
  usedAt: z.string().nullable().optional(),
});
type Card = z.infer<typeof Card>;
const Done = z.object({ lines: z.array(z.string()) }).passthrough();

/** Longest side 1600 px, JPEG: a phone photo becomes a few hundred KB. */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function BillPhoto({ r, onDone }: { r: RemoraView; onDone?: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [params] = useSearchParams();
  const [card, setCard] = useState<Card | null>(null);
  const [busy, setBusy] = useState<"" | "read" | "split" | "pay">("");
  const [amount, setAmount] = useState("");
  const [who, setWho] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState("");
  const linked = params.get("bill");

  useEffect(() => {
    if (!linked) return;
    void call("GET", `/api/remoras/${r.id}/bill/${linked}`, Card).then((out) => {
      if (out.ok) setCard(out.data);
    });
  }, [linked, r.id]);

  const read = async (file: File | null | undefined) => {
    if (!file) return;
    setBusy("read");
    setError("");
    setLines([]);
    try {
      const image = await shrink(file);
      const out = await call("POST", `/api/remoras/${r.id}/bill`, Card, { image });
      if (!out.ok) return setError(out.error);
      setCard(out.data);
      setWho(out.data.contacts[0] ?? "");
    } catch {
      setError("That file isn't a photo this browser can open.");
    } finally {
      setBusy("");
    }
  };

  const act = async (kind: "split" | "pay") => {
    if (!card) return;
    setBusy(kind);
    setError("");
    const name = who || card.contacts[0] || "";
    const out = await call("POST", `/api/remoras/${r.id}/bill/${card.eventId}/act`, Done, {
      kind,
      ...(kind === "split" ? { with: [name] } : { to: name }),
      ...(amount.trim() ? { amount: amount.trim() } : {}),
    });
    setBusy("");
    if (!out.ok) return setError(out.error);
    setLines(out.data.lines);
    setCard({ ...card, usedAt: new Date().toISOString() });
    onDone?.();
  };

  return (
    <div className="flex flex-col gap-3" data-testid="bill-photo">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          aria-label="A photo of a bill"
          data-testid="bill-file"
          onChange={(e) => void read(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy !== ""}
          onClick={() => input.current?.click()}
          data-testid="bill-attach"
        >
          {busy === "read" ? <Spinner /> : <Camera className="size-4" aria-hidden />} Photo of a
          bill
        </Button>
        <span className="text-sm text-ob-muted">It reads the total; the photo isn't kept.</span>
      </div>
      {card ? (
        <div
          className="flex flex-col gap-2 rounded-lg border border-ob-accent/40 bg-ob-accent/5 p-3 text-md"
          data-testid="bill-card"
        >
          <b data-testid="bill-text">{card.text}</b>
          {card.items.length ? (
            <ul className="text-sm text-ob-secondary" aria-label="Items on the bill" data-ux-skip>
              {card.items.slice(0, 6).map((i) => (
                <li key={`${i.name}-${i.amount}`}>
                  {i.name}
                  {i.amount ? ` · ${i.amount}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {card.instructions ? (
            <p
              className="rounded-md bg-ob-warning-soft px-2 py-1 text-sm text-ob-warning-text"
              data-testid="bill-injection"
            >
              The photo also says: “{card.instructions}”. Treated as text: nothing was done.
            </p>
          ) : null}
          <p className="text-xs text-ob-muted" data-testid="bill-why">
            Why? {card.why}
          </p>
          {card.usedAt ? (
            <Badge variant="secondary">done</Badge>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {card.ask ? (
                <Input
                  aria-label="Amount in USDC"
                  placeholder="Amount in USDC"
                  value={amount}
                  className="w-36"
                  onChange={(e) => setAmount(e.target.value)}
                />
              ) : null}
              <Input
                aria-label="With whom"
                placeholder="Name"
                value={who}
                className="w-32"
                onChange={(e) => setWho(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                disabled={busy !== "" || (!card.amount && !amount.trim()) || !who.trim()}
                onClick={() => void act("split")}
                data-testid="bill-split"
              >
                {busy === "split" ? <Spinner /> : <Split className="size-4" aria-hidden />} Split
                half
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  busy !== "" || (!card.amount && !amount.trim()) || !card.contacts.includes(who)
                }
                onClick={() => void act("pay")}
                data-testid="bill-pay"
              >
                {busy === "pay" ? <Spinner /> : <HandCoins className="size-4" aria-hidden />} Pay{" "}
                {who || "a contact"}
              </Button>
            </div>
          )}
          {lines.length ? (
            <ul className="flex flex-col gap-1 text-sm" data-testid="bill-result">
              {lines.map((l) => (
                <li key={l} className="break-words">
                  {l}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="text-md text-ob-danger-text">{error}</p> : null}
    </div>
  );
}
