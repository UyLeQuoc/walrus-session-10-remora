/** A template you can start from, on the empty Remoras page and in Home (D1, D2). */
import type { Template } from "@remora/schema";
import { Package, Shield } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { GalleryCard } from "@/openbot/pages";

export function TemplateCard({ slug, template }: { slug: string; template: Template }) {
  const spends = Boolean(template.budgetSuggestion.perPaymentUsd);
  return (
    <Link
      to={`/remoras/new?template=${slug}`}
      className="block min-w-0 rounded-ob-card text-left focus-visible:shadow-[0_0_0_1px_var(--openbot-border-focus)] focus-visible:outline-none"
    >
      <GalleryCard
        as="div"
        interactive
        media={spends ? <Package /> : <Shield />}
        title={
          <>
            {template.name}
            <Badge variant={spends ? "accent" : "secondary"}>
              {spends ? "Spends USDC" : "Read-only"}
            </Badge>
          </>
        }
      >
        {template.summary}
      </GalleryCard>
    </Link>
  );
}
