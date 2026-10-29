/**
 * H5: share one Wake as a public proof link. Rendered only when the viewer owns the Wake (the
 * callers decide: the Why? panel for the owner's own feed, `/verify/:ref` via `useOwnsWake`).
 * Sharing is confirmed first and says what becomes public; after that: the link, Copy, and
 * "Stop sharing". Errors stay in the dialog (ADR-0036); outcomes toast (N6).
 */
import { Copy, Link2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/app/confirm-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { shareUrl, shareWake, unshareWake } from "./share-api";

export function ShareControl({ wakeId }: { wakeId: string }) {
  const [link, setLink] = useState<string | null>(null);

  if (!link)
    return (
      <ConfirmAction
        tone="default"
        trigger={
          <Button type="button" variant="outline" size="sm" className="self-start">
            <Link2 aria-hidden /> Share proof
          </Button>
        }
        title="Share this proof publicly?"
        description={
          <>
            Anyone with the link can open it without signing in. They will see what the remora did
            (the action, the amount and who was paid), when, the transaction, and the checks against
            Sui. They will not see your messages, the remora's prompt or memories, its reasoning, or
            your account. You can stop sharing at any time and the link stops working.
          </>
        }
        confirmLabel="Create public link"
        onConfirm={async () => {
          setLink(shareUrl(await shareWake(wakeId)));
          toast.success("Public link created.");
        }}
      />
    );

  return (
    <div className="flex flex-col gap-2" data-testid="share-link">
      <div className="flex items-center gap-2">
        <Input readOnly aria-label="Public link" value={link} onFocus={(e) => e.target.select()} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            void navigator.clipboard
              ?.writeText(link)
              .then(() => toast.success("Link copied."))
              .catch(() => toast.error("Couldn't copy; select the link instead."))
          }
        >
          <Copy aria-hidden /> Copy link
        </Button>
      </div>
      <ConfirmAction
        trigger={
          <Button type="button" variant="ghost" size="sm" className="self-start">
            Stop sharing
          </Button>
        }
        title="Stop sharing this proof?"
        description="The link will stop working for everyone who has it. You can share again later; that makes the proof public again."
        confirmLabel="Stop sharing"
        onConfirm={async () => {
          await unshareWake(wakeId);
          setLink(null);
          toast.success("Stopped sharing.");
        }}
      />
    </div>
  );
}
