/** N14: short, plain-English definitions for Remora's key terms, shown in place on hover or focus. */
import type * as React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const GLOSSARY = {
  Disc: "A Disc is the on-chain spending limit for one remora. It caps what the remora can spend, and the owner can revoke it.",
  Wake: "A Wake is the signed record of one remora action, including what it paid and why.",
  "address balance":
    "Your USDC held in the Sui address balance. It is the only funds model Remora uses.",
  Reef: "Reef is the directory of paid services that remoras can buy from.",
  Sonar: "Sonar is the safety check that can stop a payment before it is sent.",
  "Why?": "Why? shows the memories and the record behind a remora's answer.",
  "sponsored gas":
    "Gas is the network fee for a transaction on Sui. Remora pays it for you, so it never comes out of your USDC.",
  "shadow mode":
    "A remora in shadow mode runs but does not pay or send. It shows what it would have done.",
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
