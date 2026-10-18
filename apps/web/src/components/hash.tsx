/**
 * A 66-character object id, shown short, readable in full, and copyable.
 *
 * Three of these appear on /me and every one was truncated with no way to see
 * the rest. A hash you cannot read or copy is decoration.
 */

import { CopyButton } from "@/components/copy-button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Web3Address } from "@/components/web3-address";

export function Hash({
  value,
  href,
  label,
}: {
  value: string;
  href?: string | null;
  label?: string;
}) {
  const text = <Web3Address value={value} className="text-xs" />;

  return (
    /*
     * The provider lives here rather than once at the app root. Radix throws
     * without one, and mounting a page on its own, which every render test
     * does, would otherwise take the whole page down over a truncated hash.
     * Nesting providers is allowed and costs nothing.
     */
    <TooltipProvider delayDuration={200}>
      <span className="flex min-w-0 max-w-full flex-1 items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            {href ? (
              <a
                className="block min-w-0 flex-1 underline"
                href={href}
                target="_blank"
                rel="noreferrer"
              >
                {text}
              </a>
            ) : (
              <span className="block min-w-0 flex-1">{text}</span>
            )}
          </TooltipTrigger>
          <TooltipContent className="max-w-[min(90vw,28rem)] break-all font-mono text-[11px]">
            {value}
          </TooltipContent>
        </Tooltip>
        <CopyButton value={value} label={label ?? "value"} />
      </span>
    </TooltipProvider>
  );
}
