/**
 * `/reef/new` (E8, ADR-0113): list an x402 API in the Reef. The server probes the URL once, unpaid,
 * and shows what its 402 asks for. The owner signs a message naming exactly that, and the API shows
 * in the Reef as "community". A remora pays it only after its owner lets it, with one signature.
 */
import { useSignPersonalMessage } from "@mysten/dapp-kit";
import { Check, PlugZap } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Hash } from "@/components/hash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, errorMessage } from "@/lib/api";
import { usdc } from "@/lib/usdc";

interface Probe {
  url: string;
  payTo: string;
  price: string;
  description: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `The server answered ${res.status}.`));
  return (await res.json()) as T;
}

export function ListApiPage() {
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [url, setUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [blurb, setBlurb] = useState("");
  const [found, setFound] = useState<{ probe: Probe; message: string } | null>(null);
  const [listed, setListed] = useState(false);
  const [busy, setBusy] = useState<"" | "probe" | "list">("");
  const [error, setError] = useState("");

  const probe = async () => {
    setBusy("probe");
    setError("");
    setFound(null);
    try {
      setFound(await post("/api/reef/probe", { url, slug }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  };
  const list = async () => {
    if (!found) return;
    setBusy("list");
    setError("");
    try {
      const { signature } = await signPersonalMessage({
        message: new TextEncoder().encode(found.message),
      });
      await post("/api/reef/listings", { url, slug, blurb, signature });
      setListed(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <Page title="List your API">
      <PageHeader
        title="List your API"
        description="Any x402 API on Sui testnet can be bought by remoras. Paste its URL; we read what it asks for, you sign, and it's in the Reef."
      />
      <Section title="Your API">
        <div className="flex max-w-xl flex-col gap-3" data-testid="list-api">
          <Input
            aria-label="Its URL"
            placeholder="https://your-api.example/haiku"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setFound(null);
            }}
          />
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
            <Input
              aria-label="Its name in the Reef"
              placeholder="@haiku"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.replace(/^@/, "").toLowerCase());
                setFound(null);
              }}
            />
            <Input
              aria-label="One line about it"
              placeholder="What it does, in one line"
              maxLength={140}
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
            />
          </div>
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={!!busy || !url || !slug}
              onClick={() => void probe()}
            >
              {busy === "probe" ? <Spinner /> : <PlugZap />} Check it
            </Button>
          </div>
          {found ? (
            <div
              className="flex flex-col gap-2 rounded-ob-card border border-ob-border p-4 text-md"
              data-testid="list-api-found"
            >
              <p>
                It asks <b>{usdc(found.probe.price)} USDC</b> a call, paid to
              </p>
              <Hash value={found.probe.payTo} label="paid to" />
              {found.probe.description ? (
                <p className="text-ob-secondary">“{found.probe.description}”</p>
              ) : null}
              <p className="text-xs text-ob-muted">
                You sign a message naming this URL, price and address. It signs nothing else: no
                transaction, no spending.
              </p>
              {listed ? (
                <p
                  className="flex items-center gap-2 text-ob-success-text"
                  data-testid="list-api-done"
                >
                  <Check className="size-4" aria-hidden /> Listed as @{slug}.{" "}
                  <Link className="link" to="/reef">
                    See it in the Reef
                  </Link>
                </p>
              ) : (
                <div>
                  <Button type="button" disabled={!!busy} onClick={() => void list()}>
                    {busy === "list" ? <Spinner /> : null} Sign and list
                  </Button>
                </div>
              )}
            </div>
          ) : null}
          {error ? <p className="text-md text-ob-danger-text">{error}</p> : null}
        </div>
      </Section>
    </Page>
  );
}
