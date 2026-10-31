/** N14: short, plain-English definitions for Remora's key terms, shown in place on hover or focus. */
import type * as React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const GLOSSARY = {
  "spending limit":
    "What one remora may spend: a monthly limit, a cap per payment and the services it may pay. Sui enforces it onchain, and you can pause or revoke it from your wallet.",
  receipt:
    "The signed record of one remora action: what it read, what it paid and why. Anyone can check it.",
  "address balance":
    "Your USDC held in the Sui address balance. It is the only funds model Remora uses.",
  services: "The directory of paid services that remoras can buy from.",
  "safety check": "An independent check that can stop a payment before it is signed.",
  "Why?": "Why? shows the memories and the receipt behind a remora's answer.",
  "sponsored gas":
    "Gas is the network fee for a transaction on Sui. Remora pays it for you, so it never comes out of your USDC.",
  "practice mode":
    "A remora in practice mode runs but does not pay or send. It shows what it would have done.",
} as const;

export type GlossaryTerm = keyof typeof GLOSSARY;

/** Wraps a term with its glossary tooltip. Keeps the text as it was; only adds the hover and focus hint. */
export function Term({ name, children }: { name: GlossaryTerm; children?: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-testid="glossary-term"
            data-term={name}
            className="inline cursor-help appearance-none bg-transparent p-0 font-[inherit] text-[inherit] underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {children ?? name}
          </button>
        </TooltipTrigger>
        <TooltipContent>{GLOSSARY[name]}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
