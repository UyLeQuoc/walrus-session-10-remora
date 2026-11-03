/**
 * F4, F5, F8, F9 in the inspector (ADR-0048): the owner's controls over a remora's memory, worded
 * for what Walrus Memory can actually do. Nothing stored can be deleted or edited, so hiding is our
 * own filter, a correction supersedes a fact, and "forget all" only drops a namespace's index.
 */
import { ChevronRight, Copy, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { api, download } from "@/features/remoras/api";
import { API_URL, identityHeaders } from "@/lib/api";

type Mem = { blobId: string; namespace: string };

export function HideButton({
  remoraId,
  m,
  hidden,
  onDone,
}: {
  remoraId: string;
  m: Mem;
  hidden: boolean;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={busy}
      aria-label={`${hidden ? "Show" : "Hide"} ${m.blobId}`}
      onClick={async () => {
        setBusy(true);
        const r = await api.hideMemory(remoraId, {
          blobId: m.blobId,
          namespace: m.namespace,
          hidden: !hidden,
        });
        setBusy(false);
        if (!r.ok) return void toast.error(r.error);
        toast.success(
          hidden ? "It's used again." : "Hidden: it won't be recalled. The blob stays on Walrus.",
        );
        onDone();
      }}
    >
      {hidden ? "Show" : "Hide"}
    </Button>
  );
}

export function CorrectDialog({
  remoraId,
  m,
  current,
  onDone,
}: {
  remoraId: string;
  m: Mem;
  current?: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const r = await api.correctMemory(remoraId, {
      blobId: m.blobId,
      namespace: m.namespace,
      text,
    });
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success("Corrected. The old fact isn't recalled any more.");
    setOpen(false);
    setText("");
    onDone();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost" aria-label={`Correct ${m.blobId}`}>
          Correct
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct this memory</DialogTitle>
          <DialogDescription>
            Walrus Memory can't edit a stored fact. Remora writes your correction as a new memory
            that names this one, and stops recalling the old one.
          </DialogDescription>
        </DialogHeader>
        {current ? (
          <p className="rounded-ob-md bg-ob-control-hover p-2.5 text-xs whitespace-pre-wrap text-ob-secondary">
            {current}
          </p>
        ) : null}
        <Textarea
          aria-label="The right fact"
          placeholder="What's true instead"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <DialogFooter>
          <Button type="button" disabled={busy || !text.trim()} onClick={() => void save()}>
            Save the correction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ForgetButton({
  remoraId,
  namespace,
  onDone,
}: {
  remoraId: string;
  namespace: string;
  onDone: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Forget all in {namespace}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Forget everything in {namespace}?</AlertDialogTitle>
          <AlertDialogDescription>
            It stops recalling these memories right away. Walrus Memory can't delete stored blobs,
            so they stay encrypted on Walrus until they expire (about 210 days after each was
            written).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep them</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              const r = await api.forgetMemory(remoraId, namespace);
              if (!r.ok) return void toast.error(r.error);
              toast.success(r.data.note);
              onDone();
            }}
          >
            Forget all
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

async function save(path: string, name: string) {
  const r = await download(path, "Couldn't export the memory.");
  if (!r.ok) return void toast.error(r.error);
  const url = URL.createObjectURL(r.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButtons({ remoraId, name }: { remoraId: string; name: string }) {
  const stem = `${name.replace(/[^\w-]+/g, "-").toLowerCase()}-memory`;
  // ADR-0103: one Export menu, not two buttons above the list (a phone saw them before any memory).
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Download /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onSelect={() => void save(`/api/remoras/${remoraId}/memory/export`, `${stem}.json`)}
        >
          Export JSON
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            void save(`/api/remoras/${remoraId}/memory/export?format=md`, `${stem}.md`)
          }
        >
          Export Markdown
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ExpiryAlert({ count }: { count: number }) {
  if (!count) return null;
  return (
    <Alert variant="warning" data-testid="expiry-alert">
      <AlertTitle>
        {count} memor{count === 1 ? "y expires" : "ies expire"} within 30 days
      </AlertTitle>
      <AlertDescription>
        Walrus keeps a memory for the epochs paid for, then it's gone. Export them to keep a copy.
      </AlertDescription>
    </Alert>
  );
}

/** F9: read this remora's memory from Claude Code through Remora's MCP server. */
export function ClaudeCodeCard({
  remoraId,
  namespaces,
}: {
  remoraId: string;
  namespaces: string[];
}) {
  const session = identityHeaders()["x-remora-session"];
  const server = API_URL || window.location.origin;
  const command = `claude mcp add remora -e REMORA_SESSION=${session ?? "<sign in first>"} -e REMORA_API_URL=${server} -- bun <repo>/packages/mcp/src/bin.ts`;
  return (
    <details
      className="group rounded-ob-card border border-ob-border-grouped bg-ob-grouped text-md open:pb-4"
      data-testid="claude-code"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-ob-card px-4 font-medium text-ob-text hover:bg-ob-hover [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-4 text-ob-muted transition-transform group-open:rotate-90"
        />
        Use this memory in Claude Code
      </summary>
      <div className="mt-1 flex flex-col gap-2 px-4">
        <p className="text-ob-muted">
          Remora's MCP server maps these namespaces, so Claude Code can recall from them with
          <code className="mx-1 rounded-ob-xs bg-ob-control-hover px-1 font-mono text-xs">
            remora_recall
          </code>
          . The command carries your session: anyone who has it can read your remoras until you sign
          out.
        </p>
        <ul className="flex flex-col gap-0.5 font-mono text-xs" aria-label="Namespaces for MCP">
          {namespaces.map((ns) => (
            <li key={ns}>
              remora:{remoraId}:{ns}
            </li>
          ))}
        </ul>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          disabled={!session}
          onClick={() =>
            void navigator.clipboard
              ?.writeText(command)
              .then(() => toast.success("Setup command copied."))
              .catch(() => toast.error("Couldn't copy; select it from the page instead."))
          }
        >
          <Copy /> Copy the setup command
        </Button>
      </div>
    </details>
  );
}
