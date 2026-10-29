/**
 * Every destructive action goes through this (ADR-0036): a dialog, a spinner inside the confirm
 * button, errors kept in the dialog, and Escape cancels.
 */
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  tone = "danger",
  disabled,
  confirmWord,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  tone?: "danger" | "default";
  disabled?: boolean;
  /** Irreversible actions: the confirm button stays off until this word is typed (any case). */
  confirmWord?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const wordOk = !confirmWord || typed.trim().toLowerCase() === confirmWord.toLowerCase();

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) {
          setError("");
          setTyped("");
        }
      }}
    >
      <AlertDialogTrigger asChild disabled={disabled}>
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {confirmWord ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-word" className="text-sm font-normal">
              Type <strong>{confirmWord}</strong> to confirm
            </Label>
            <Input
              id="confirm-word"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={typed}
              disabled={busy}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant={tone === "danger" ? "destructive" : "default"}
            disabled={busy || !wordOk}
            onClick={() => void run()}
          >
            {busy ? <Spinner /> : null}
            {busy ? "Working…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
