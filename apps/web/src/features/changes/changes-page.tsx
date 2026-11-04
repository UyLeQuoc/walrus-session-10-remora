/**
 * `/changes/:id` (C2, ADR-0123): the sign link a chat command sends, from Telegram or anywhere. The
 * owner signs in, sees the change before → after, and signs it in their wallet; nothing changes
 * until they do.
 */
import { useParams } from "react-router";
import { Page, PageHeader } from "@/components/app/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Problem } from "@/components/visual";
import { api } from "@/features/remoras/api";
import { RequireOwner, useLoad } from "@/features/remoras/hooks";
import { useNetwork } from "@/lib/network";
import { ChangeCard } from "./change-card";

function Change({ id }: { id: string }) {
  const network = useNetwork();
  const change = useLoad(() => api.change(id), [id]);
  return (
    <Page title="A change to sign" description="A change you asked for in chat.">
      <PageHeader title="A change you asked for" description="Nothing changes until you do." />
      <div className="w-full max-w-xl">
        {change.data ? (
          <ChangeCard
            key={change.data.change.status}
            id={change.data.id}
            change={change.data.change}
            network={network}
          />
        ) : change.error ? (
          <Problem title="Can't open this change." detail={change.error} />
        ) : (
          <Skeleton className="h-32 w-full rounded-ob-card" />
        )}
      </div>
    </Page>
  );
}

export function ChangesPage() {
  const { id = "" } = useParams();
  return (
    <RequireOwner what="this change" needsWallet>
      {() => <Change id={id} />}
    </RequireOwner>
  );
}
