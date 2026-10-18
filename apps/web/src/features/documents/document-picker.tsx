import { FileText, Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StoredFile } from "@/features/documents/use-documents";

export function DocumentPicker({
  open,
  onOpenChange,
  files,
  refusal,
  busy,
  status,
  error,
  onUpload,
  onOpen,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: StoredFile[];
  refusal: string | null;
  busy: boolean;
  status: string;
  error: string;
  onUpload: (file: File) => void;
  onOpen: (file: StoredFile) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Private files</DialogTitle>
          <DialogDescription>
            Encrypted in this browser with Seal and stored on Walrus, paid by your wallet. hippo
            reads only the file you attach, only when you ask, and never keeps its text.
          </DialogDescription>
        </DialogHeader>
        {refusal ? (
          <p className="text-sm text-muted-foreground">{refusal}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <input
              ref={input}
              type="file"
              accept=".txt,.md,.markdown,text/plain,text/markdown"
              className="hidden"
              aria-label="Choose a file to upload"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onUpload(file);
              }}
            />
            <Button type="button" disabled={busy} onClick={() => input.current?.click()}>
              <Upload />
              Upload a .txt or .md file
            </Button>
            {files.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Your files</p>
                {files.map((file) => (
                  <Button
                    key={file.id}
                    type="button"
                    variant="outline"
                    disabled={busy}
                    className="justify-start"
                    onClick={() => onOpen(file)}
                  >
                    <FileText />
                    <span className="truncate">{file.name}</span>
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        )}
        {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
