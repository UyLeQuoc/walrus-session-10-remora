import { marked } from "marked";
import { memo, useId, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { CopyButton } from "@/components/copy-button";
import { fencedBlock } from "@/features/chat/fenced-block";
import { messageActionClass } from "@/features/chat/message-action";
import { cn } from "@/lib/utils";

const components: Components = {
  p: ({ children }) => <p className="leading-relaxed [&:not(:first-child)]:mt-3">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  a: ({ href, children }) => (
    <a href={href} className="underline underline-offset-2" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const fenced = typeof className === "string" && className.includes("language-");
    if (fenced) return <code className={cn("font-mono text-xs", className)}>{children}</code>;
    return <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>;
  },
  pre: ({ children }) => {
    const block = fencedBlock(children);
    const label = block.language ? `${block.language} code` : "code";
    return (
      <div className="my-3 overflow-hidden rounded-lg bg-muted">
        <div className="flex items-center gap-2 px-3 pt-3">
          {block.language ? (
            <span className="text-sm text-muted-foreground">{block.language}</span>
          ) : null}
          <div className="ml-auto">
            <CopyButton
              value={block.text}
              label={label}
              variant="ghost"
              size="icon-sm"
              className={messageActionClass}
            />
          </div>
        </div>
        <pre className="overflow-x-auto px-3 pb-3 font-mono text-xs leading-relaxed">
          {children}
        </pre>
      </div>
    );
  },
};

function blocksOf(markdown: string): string[] {
  try {
    return marked.lexer(markdown).map((token) => token.raw);
  } catch {
    return [markdown];
  }
}

const MarkdownBlock = memo(
  function MarkdownBlock({ content }: { content: string }) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {content}
      </ReactMarkdown>
    );
  },
  (prev, next) => prev.content === next.content,
);

export const Markdown = memo(function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const blockId = useId();
  const blocks = useMemo(() => blocksOf(children), [children]);
  return (
    <div className={cn("max-w-none text-sm leading-relaxed", className)}>
      {blocks.map((block, index) => (
        <MarkdownBlock key={`${blockId}-${index}`} content={block} />
      ))}
    </div>
  );
});
