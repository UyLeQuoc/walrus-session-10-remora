/**
 * The account on Sui, read from the chain, with the keys that can reach it.
 *
 * Everything else on /me is hippo's account of itself. This is the part a user
 * does not have to believe: the object id resolves on an explorer, the delegate
 * list is what the contract enforces, and the revoke button removes an entry
 * from that exact list. Showing our own `delegate_keys` table here would have
 * been easier and would have proved nothing.
 */

import { Hash } from "@/components/hash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount } from "@/features/me/use-account";

export function ChainPanel({ owned, onError }: { owned: boolean; onError: (m: string) => void }) {
  const { account, busy, start } = useAccount(onError);

  if (account === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (account === null) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        {owned ? null : <CardDescription>Still hippo's own account.</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {owned ? null : (
          <Button disabled={busy} onClick={() => void start("connect")}>
            {busy ? "Opening…" : "Own this memory"}
          </Button>
        )}
        <dl className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="shrink-0 text-muted-foreground">Account</dt>
            <dd className="min-w-0 flex-1">
              <Hash value={account.accountId} href={account.explorerUrl} label="account id" />
            </dd>
          </div>
          {account.owner && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 text-muted-foreground">Owner</dt>
              <dd className="min-w-0 flex-1">
                <Hash value={account.owner} href={account.ownerUrl} label="owner" />
              </dd>
            </div>
          )}
        </dl>

        {account.unreadable ? (
          <p className="text-sm text-muted-foreground">
            The object could not be read from the chain just now. The link above still resolves.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Keys that can read this memory ({account.delegates?.length ?? 0})
            </p>
            <ul className="divide-y rounded-md border text-sm">
              {(account.delegates ?? []).map((d) => (
                <li
                  key={d.publicKeyHex}
                  className="group flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="flex items-center gap-2">
                    <span>{d.label || "unlabelled"}</span>
                    {d.isHippo && <Badge variant="accent">hippo</Badge>}
                  </span>
                  <Hash value={d.publicKeyHex} label="public key" />
                </li>
              ))}
              {(account.delegates?.length ?? 0) === 0 && (
                <li className="px-3 py-2 text-muted-foreground">
                  No delegate keys. Nothing but the owner can read this account.
                </li>
              )}
            </ul>
          </div>
        )}

        {owned ? (
          <Button variant="destructive" disabled={busy} onClick={() => void start("disconnect")}>
            {busy ? "Opening…" : "Revoke hippo's access"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
