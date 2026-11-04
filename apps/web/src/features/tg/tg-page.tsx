/**
 * `/tg` (H3, ADR-0115): Remora inside Telegram. The Mini App opens from the bot's menu button with
 * Telegram's signed launch data in the URL (`#tgWebAppData=…`). Every call sends it, and the server
 * checks it with the bot's token and answers for the owner who linked that Telegram account. It shows
 * the remoras, the last receipts and what waits on the owner, and pauses everything in one tap.
 * Anything that needs the wallet (approving, pausing onchain) opens the web app.
 */
import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Hash } from "@/components/hash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Empty, Receipt } from "@/components/visual";
import { apiFetch } from "@/lib/api";
import { payeeName } from "@/lib/payee";
import { explorerTx, usdc } from "@/lib/usdc";

interface Overview {
  remoras: { id: string; name: string; template: string; status: string }[];
  receipts: { remora: string; payee: string; amount: string; digest: string | null; at: string }[];
  approvals: { id: string; remora: string; summary: string }[];
  web: string;
}

/** Telegram puts the signed launch data in the URL's fragment. */
export function launchData(hash: string): string {
  return new URLSearchParams(hash.replace(/^#/, "")).get("tgWebAppData") ?? "";
}

export function TgPage() {
  const [initData] = useState(() => launchData(window.location.hash));
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const call = useCallback(
    async (path: string, body?: unknown) => {
      const res = await apiFetch(path, {
        method: body === undefined ? "GET" : "POST",
        headers: { "content-type": "application/json", "x-telegram-init-data": initData },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const json = (await res.json().catch(() => ({}))) as Overview & {
        error?: { message?: string };
      };
      if (!res.ok) throw new Error(json.error?.message ?? `The server answered ${res.status}.`);
      return json;
    },
    [initData],
  );
  useEffect(() => {
    if (!initData) return;
    call("/api/tg/me").then(setData, (err: Error) => setError(err.message));
  }, [call, initData]);

  const live = (data?.remoras ?? []).filter((r) => r.status === "active" || r.status === "shadow");
  const paused = (data?.remoras ?? []).some((r) => r.status === "paused") && !live.length;
  const pause = async () => {
    setBusy(true);
    try {
      setData(await call("/api/tg/pause", { paused: !paused }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Remora">
      <PageHeader title="Remora" description="Your remoras, from Telegram." />
      {!initData ? (
        <Empty title="Open this from Remora's bot in Telegram (the menu button)." />
      ) : error ? (
        <p className="text-md text-ob-danger-text" data-testid="tg-error">
          {error}
        </p>
      ) : !data ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-6" data-testid="tg">
          <Button
            type="button"
            size="lg"
            variant={paused ? "default" : "destructive"}
            disabled={busy || !data.remoras.length}
            onClick={() => void pause()}
          >
            {busy ? <Spinner /> : paused ? <Play /> : <Pause />}{" "}
            {paused ? "Resume all" : "Pause all"}
          </Button>
          <Section title="Your remoras">
            <ul className="flex flex-col divide-y divide-ob-border" aria-label="Remoras">
              {data.remoras.map((r) => (
                <li key={r.id} className="flex items-center gap-2 py-2 text-md">
                  <span className="font-medium">{r.name}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {r.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </Section>
          {data.approvals.length ? (
            <Section title="Waiting on you">
              <ul className="flex flex-col gap-2" aria-label="Waiting on you">
                {data.approvals.map((a) => (
                  <li key={a.id} className="flex flex-col gap-1 text-md">
                    <span>
                      <b>{a.remora}</b>: {a.summary}
                    </span>
                    <a
                      className="link text-sm"
                      href={`${data.web}/approvals`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Approve in Remora (your wallet signs)
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          <Section title="Last receipts">
            {data.receipts.length ? (
              <ul className="grid gap-2" aria-label="Receipts">
                {data.receipts.map((r, i) => (
                  <li key={r.digest ?? i}>
                    <Receipt
                      compact
                      data-testid="tg-receipt"
                      amount={usdc(r.amount)}
                      payee={`${payeeName(r.payee)} · ${r.remora}`}
                      at={r.at}
                      proof={
                        r.digest ? (
                          <Hash
                            value={r.digest}
                            href={explorerTx("testnet", r.digest)}
                            label="paid in"
                          />
                        ) : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="No payments yet." />
            )}
          </Section>
        </div>
      )}
    </Page>
  );
}
