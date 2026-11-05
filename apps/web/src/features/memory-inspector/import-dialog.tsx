/**
 * A4 (ADR-0146): "Import" in the Memory Inspector. What you already wrote for Claude Code, Codex,
 * Cursor or ChatGPT becomes candidate lines; you tick the ones to keep. Each is stored with its
 * source, and the remora reads it as a note, never as an instruction.
 */
import { FileUp, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { ImportCommitted, ImportPreview } from "./memory-api";
import { useImport } from "./use-import";

const KIND: Record<ImportPreview["kind"], string> = {
  claude: "Claude Code memory",
  agents: "AGENTS.md",
  cursor: "Cursor rule",
  chatgpt: "ChatGPT export",
  markdown: "Markdown",
};

export function ImportDialog({
  remoraId,
  onDone,
}: {
  remoraId: string;
  onDone: (r: ImportCommitted) => void;
}) {
  const [open, setOpen] = useState(false);
  const imp = useImport(remoraId, (r) => {
    toast.success(`Imported ${r.written} line${r.written === 1 ? "" : "s"} into ${r.namespace}.`);
    onDone(r);
  });
  const p = imp.preview;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) imp.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" data-testid="memory-import">
          <Upload aria-hidden /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import what you already wrote down</DialogTitle>
          <DialogDescription>
            A Claude Code CLAUDE.md, MEMORY.md or memory file, a Codex AGENTS.md, a Cursor rule
            (.mdc), ChatGPT's conversations.json, or any Markdown, up to 5 MB. Keys, emails, phone
            numbers and handles are taken out first. Every line you keep is stored with its source,
            and your remora reads it as a note, never as an instruction.
          </DialogDescription>
        </DialogHeader>

        {imp.done ? (
          <div className="flex flex-col gap-2 text-md" data-testid="import-done">
            <p className="font-medium">
              Imported {imp.done.written} line{imp.done.written === 1 ? "" : "s"} into{" "}
              {imp.done.namespace}
              {imp.done.skipped ? `; ${imp.done.skipped} were already there` : ""}.
            </p>
            <p className="text-ob-secondary">{imp.done.note}</p>
          </div>
        ) : p ? (
          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-sm text-ob-secondary" data-testid="import-summary">
              {p.fileName} · {KIND[p.kind]} · {p.candidates.length} line
              {p.candidates.length === 1 ? "" : "s"} found
              {p.analyzed
                ? ` · Walrus Memory's analyze read ${p.analyzed} of ${p.chunks} part${p.chunks === 1 ? "" : "s"}`
                : " · split as written"}
              {p.scrubbed.length ? ` · took out: ${p.scrubbed.join(", ")}` : ""}
            </p>
            <ul className="ob-group max-h-80 min-w-0 overflow-y-auto" aria-label="Lines to import">
              {p.candidates.map((c) => (
                <li key={c.i} className="flex min-w-0 items-start gap-3 px-4 py-2.5 text-md">
                  <Checkbox
                    id={`import-${c.i}`}
                    className="mt-1"
                    checked={imp.ticked.has(c.i)}
                    disabled={!imp.ticked.has(c.i) && imp.ticked.size >= imp.max}
                    onCheckedChange={(on) => imp.toggle(c.i, on === true)}
                    aria-label={`Keep: ${c.text}`}
                  />
                  <label htmlFor={`import-${c.i}`} className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="break-words" data-ux-skip>
                      {c.text}
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {c.at ? <Badge variant="outline">{c.at}</Badge> : null}
                      {c.via === "analyze" ? <Badge variant="outline">analyze</Badge> : null}
                      {c.flag ? (
                        <Badge variant="destructive" title="It's only ever stored as text">
                          {c.flag}
                        </Badge>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={imp.namespace} onValueChange={imp.setNamespace}>
                <SelectTrigger aria-label="Namespace" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {p.namespaces.map((ns) => (
                    <SelectItem key={ns} value={ns}>
                      {ns}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-ob-muted" data-testid="import-ticked">
                {imp.ticked.size} of at most {imp.max} ticked
              </span>
              <Button type="button" variant="ghost" onClick={imp.tickNone}>
                Untick all
              </Button>
            </div>
            <p className="font-mono text-xs break-all text-ob-muted">Each ends “· {p.source}”</p>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            <Textarea
              aria-label="Text to import"
              placeholder="Paste a CLAUDE.md, AGENTS.md, rules or notes here"
              className="max-h-64 min-h-32 font-mono text-xs"
              value={imp.text}
              onChange={(e) => imp.paste(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild type="button" variant="outline">
                <label>
                  <FileUp aria-hidden /> Open a file
                  <input
                    type="file"
                    accept=".md,.mdc,.markdown,.txt,.json,text/markdown,text/plain,application/json"
                    className="sr-only"
                    aria-label="Open a file to import"
                    onChange={(e) => void imp.openFile(e.target.files?.[0])}
                  />
                </label>
              </Button>
              {imp.fileName ? <span className="text-sm text-ob-muted">{imp.fileName}</span> : null}
            </div>
          </div>
        )}

        {imp.error ? (
          <Alert variant="destructive">
            <AlertDescription>{imp.error}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          {imp.done ? (
            <Button type="button" onClick={() => setOpen(false)}>
              Done
            </Button>
          ) : p ? (
            <>
              <Button type="button" variant="outline" disabled={!!imp.busy} onClick={imp.reset}>
                Back
              </Button>
              <Button
                type="button"
                disabled={!!imp.busy || !imp.ticked.size}
                onClick={() => void imp.commit()}
              >
                {imp.busy === "import" ? <Spinner /> : null} Import {imp.ticked.size} line
                {imp.ticked.size === 1 ? "" : "s"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              disabled={!!imp.busy || !imp.text.trim()}
              onClick={() => void imp.runPreview()}
            >
              {imp.busy === "preview" ? <Spinner /> : null}
              {imp.busy === "preview" ? "Reading it…" : "Preview the lines"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
