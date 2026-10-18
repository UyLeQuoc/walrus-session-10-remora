import { useShellTitle } from "@/app/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FIXTURE_APPROVALS } from "@/features/remoras/fixtures";

/** `/approvals` (N2 skeleton on fixtures): what remoras asked you to decide. Actions land in W2 (E4). */
export function ApprovalsPage() {
  useShellTitle("Approvals");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 overflow-y-auto p-4">
      {FIXTURE_APPROVALS.map((a) => (
        <Card key={a.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {a.remora} <Badge variant="outline">{a.status}</Badge>
            </CardTitle>
            <CardDescription>{a.summary}</CardDescription>
          </CardHeader>
          <CardFooter className="gap-2">
            <Button type="button" disabled title="Arrives with over-limit approvals (E4, W2)">
              Approve
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled
              title="Arrives with over-limit approvals (E4, W2)"
            >
              Reject
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
