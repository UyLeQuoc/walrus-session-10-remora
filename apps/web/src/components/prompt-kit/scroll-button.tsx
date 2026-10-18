import { ChevronDown } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ScrollButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Scroll to bottom"
      className={cn(
        "size-10 rounded-full shadow-sm transition-all duration-150",
        isAtBottom
          ? "pointer-events-none translate-y-4 scale-95 opacity-0"
          : "translate-y-0 scale-100 opacity-100",
        className,
      )}
      onClick={() => scrollToBottom()}
      {...props}
    >
      <ChevronDown className="size-5" />
    </Button>
  );
}
