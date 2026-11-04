/**
 * ADR-0106: a Researcher's empty thread lists what it can buy, each with its price from the Reef, so
 * the range shows before the first question. Nothing shows until the Reef has answered: a price is
 * never guessed.
 */
import { useReefServices } from "@/features/reef/hooks";
import { payeeName } from "@/lib/payee";
import { usdc } from "@/lib/usdc";

export function WhatItBuys() {
  const reef = useReefServices();
  if (!reef.data?.length) return null;
  return (
    <ul className="flex max-w-xl flex-wrap justify-center gap-1.5" aria-label="What it can buy">
      {reef.data.map((s) => (
        <li
          key={s.name}
          className="rounded-full border border-ob-border px-2.5 py-1 text-xs text-ob-secondary"
        >
          {payeeName(`reef:${s.name}`)}{" "}
          <span className="tabular-nums text-ob-muted">{usdc(s.priceUsdc)} USDC</span>
        </li>
      ))}
    </ul>
  );
}
