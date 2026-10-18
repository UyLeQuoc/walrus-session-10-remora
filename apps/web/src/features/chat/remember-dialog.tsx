import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isRememberType, REMEMBER_TYPES, type RememberType } from "@/features/chat/remember-types";
import type { RememberDraft } from "@/features/chat/use-selection-remember";

export function RememberDialog({
  draft,
  busy,
  error,
  onText,
  onType,
  onCancel,
  onSubmit,
}: {
  draft: RememberDraft | null;
  busy: boolean;
  error: string;
  onText: (text: string) => void;
  onType: (type: RememberType) => void;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}) {
  return (
    <Dialog
      open={draft !== null}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{draft?.replaces ? "Correct this memory" : "Remember this"}</DialogTitle>
          <DialogDescription>
            {draft?.replaces
              ? "Write what is true now. The earlier blob stays on Walrus."
              : "Edit the fact, then confirm. Nothing is stored until you do."}
          </DialogDescription>
        </DialogHeader>
        {draft ? (
          <>
            {draft.replaces ? null : (
              <Select
                value={draft.type}
                onValueChange={(value) => {
                  if (isRememberType(value)) onType(value);
                }}
              >
                <SelectTrigger aria-label="Memory type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMEMBER_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Textarea
              value={draft.text}
              aria-label="Fact to remember"
              className="max-h-60 overflow-y-auto"
              onChange={(event) => onText(event.target.value)}
            />
            {error ? <p>{error}</p> : null}
          </>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || !draft || draft.text.trim().length < 3}
            onClick={() => {
              if (draft) onSubmit(draft.text);
            }}
          >
            Remember
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
