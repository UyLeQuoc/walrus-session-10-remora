import { Link } from "react-router";
import { useShellTitle } from "@/app/shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsdc } from "@/lib/usdc";
import { FIXTURE_REMORAS } from "./fixtures";

/** `/remoras` (W1 skeleton on fixtures): every remora, its status and budget. */
export function RemorasPage() {
  useShellTitle("Remoras");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 overflow-y-auto p-4">
      <p className="text-sm text-muted-foreground">
        Sample remoras. Yours appear here once you create one (W2).
      </p>
      {FIXTURE_REMORAS.map((r) => (
        <Link key={r.id} to={`/remoras/${r.template}`} className="block">
          <Card className="transition-colors hover:bg-muted/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {r.name}
                <Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge>
              </CardTitle>
              <CardDescription>{r.persona}</CardDescription>
              <p className="text-sm text-muted-foreground">
                {r.budget
                  ? `Budget ${formatUsdc(r.budget.windowLimit)} USDC per ${r.budget.window}, at most ${formatUsdc(r.budget.perPaymentCap)} a payment`
                  : "Read-only: no budget"}
                {" · "}
                {r.triggers.map((t) => ("human" in t && t.human ? t.human : t.kind)).join(", ")}
              </p>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
