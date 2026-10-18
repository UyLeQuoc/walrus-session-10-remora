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
import { useLeaveTeam } from "@/features/team/use-leave-team";

export function TeamLeave({ name, onLeft }: { name: string; onLeft: () => Promise<void> }) {
  const { busy, error, leave } = useLeaveTeam(onLeft);

  return (
    <section className="flex flex-col gap-3 border-t pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          Leaving stops you recalling the team's memory. What you added stays with the team.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={busy}>
              {busy ? "Leaving…" : "Leave the team"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="wrap-anywhere">Leave {name}?</AlertDialogTitle>
              <AlertDialogDescription>
                What you added stays with the team: a memory on Walrus cannot be deleted. You will
                stop recalling what the team shares, and you need a new invite to come back.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => void leave()}>
                Leave
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
