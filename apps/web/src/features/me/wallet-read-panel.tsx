import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Memory } from "@/features/me/memory";
import { Section } from "@/features/me/section";
import { useWalletRead } from "@/features/me/use-wallet-read";

export function WalletReadPanel({ memories }: { memories: Memory[] }) {
  const read = useWalletRead(memories);
  return (
    <Section
      title="Read it yourself"
      description="Decrypt your memory in this browser with your wallet. No Remora server, no relayer."
      action={
        read.refusal ? null : (
          <Button
            type="button"
            disabled={read.busy || read.readable === 0}
            onClick={() => void read.read()}
          >
            {read.busy ? "Reading…" : "Read with my wallet"}
          </Button>
        )
      }
    >
      {read.refusal ? (
        <p className="text-md text-ob-muted">{read.refusal}</p>
      ) : read.readable === 0 ? (
        <p className="text-md text-ob-muted">
          Nothing in your own account yet. What you told Remora as a guest stays in Remora's
          account, which your wallet cannot open.
        </p>
      ) : null}
      {read.results.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {read.results.map((result) => (
            <li key={result.blobId} className="flex flex-wrap items-start gap-2 text-md">
              {"text" in result ? (
                <>
                  <span className="min-w-0 flex-1 break-words">{result.text}</span>
                  <Badge variant={result.verified ? "outline" : "destructive"}>
                    {result.verified ? "matches what Remora wrote" : "does not match"}
                  </Badge>
                </>
              ) : (
                <span className="text-ob-muted">
                  {result.type}: {result.error}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {read.results.length > 0 && !read.busy ? (
        <Button type="button" variant="outline" className="self-start" onClick={read.download}>
          Download what my wallet read
        </Button>
      ) : null}
      {read.error ? <p className="text-md text-ob-danger-text">{read.error}</p> : null}
    </Section>
  );
}
