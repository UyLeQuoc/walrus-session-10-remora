import { ChevronDown } from "lucide-react";
import { useState } from "react";

export interface RecalledMemory {
  type: string;
  text: string;
  relevance: number;
  blobId: string;
}

/**
 * What this answer was built from.
 *
 * Without it, memory working and the model guessing look identical: the bot just
 * sounds like it knows you. Collapsed by default so it does not crowd the
 * conversation, and every entry links to the blob on Walrus, so a claim about
 * remembering is checkable rather than asserted.
 */
export function Recalled({ memories }: { memories: RecalledMemory[] }) {
  const [open, setOpen] = useState(false);
  if (memories.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 p-0 text-sm text-muted-foreground hover:text-foreground"
      >
        {open ? "hide" : "recalled"} {memories.length}{" "}
        {memories.length === 1 ? "memory" : "memories"}
        <ChevronDown className={open ? "size-3.5 rotate-180" : "size-3.5"} />
      </button>
      {open && (
        <ul className="mt-1 space-y-1 border-l pl-3">
          {memories.map((m) => (
            <li key={m.blobId} className="text-muted-foreground">
              <span className="rounded bg-muted px-1 py-0.5 font-medium">{m.type}</span> {m.text}{" "}
              <a
                className="underline"
                href={`https://walruscan.com/mainnet/blob/${m.blobId}`}
                target="_blank"
                rel="noreferrer"
              >
                blob
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
