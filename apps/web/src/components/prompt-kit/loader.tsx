import { cn } from "@/lib/utils";

/**
 * The typing indicator prompt-kit uses while a model has not spoken yet.
 * Only the dot variants are vendored: the chat never renders the others.
 */
export function Loader({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
