/** A template you can start from, on the empty Remoras page and in Home (D1, D2). */
import type { Template } from "@remora/schema";
import { Package, Shield } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function TemplateCard({ slug, template }: { slug: string; template: Template }) {
  const spends = Boolean(template.budgetSuggestion.perPaymentUsd);
  return (
    <Link
      to={`/remoras/new?template=${slug}`}
      className="block rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {spends ? (
              <Package className="size-4 text-primary" />
            ) : (
              <Shield className="size-4 text-primary" />
            )}
            {template.name}
            <Badge variant={spends ? "accent" : "outline"}>
              {spends ? "Spends USDC" : "Read-only"}
            </Badge>
          </CardTitle>
          <CardDescription>{template.summary}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
