/**
 * `/hatchery/:id` (M3–M7, ADR-0046): one shared template. Anyone can read it and its consent screen
 * (what it may do, which Reef services it may pay and at what price, the safety review, read back
 * from Walrus); hatching asks for your wallet and takes one signature: every Disc it needs and the
 * onchain fork record together. Hatched remoras start in shadow mode with schedules paused.
 */
import type { HatchConsent } from "@remora/schema";
import { Copy, GitFork } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Hash } from "@/components/hash";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useSignAndRun } from "@/features/funds/sign";
import { api } from "@/features/remoras/api";
import { RequireOwner, useLoad } from "@/features/remoras/hooks";
import { useNetwork } from "@/lib/network";
import { explorerTx } from "@/lib/usdc";
import { HatchBadge } from "./hatch-badge";
import { PermissionsList, SafetyPanel, shortAddress } from "./parts";

const aggregator = (network: string, blobId: string) =>
  network === "testnet"
    ? `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`
    : `https://aggregator.walrus-mainnet.walrus.space/v1/blobs/${blobId}`;

function copy(text: string, what: string) {
  void navigator.clipboard
    ?.writeText(text)
    .then(() => toast.success(`${what} copied.`))
    .catch(() => toast(text));
}

function Hatch({ id, consent, owner }: { id: string; consent: HatchConsent; owner: string }) {
  const navigate = useNavigate();
  const run = useSignAndRun();
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const [signed, setSigned] = useState<{ digest: string; ids: string[] } | null>(null);
  const blocked = consent.safety.verdict === "block" || consent.listing.deprecated;

  const finish = async (digest: string, ids: string[]) => {
    setStep("Confirming onchain…");
    const done = await api.hatchConfirm(id, digest, ids);
    if (!done.ok) throw new Error(done.error);
    setSigned(null);
    toast.success(
      "Hatched. It starts in shadow mode: it shows what it would pay, and pays nothing.",
    );
    navigate(ids[0] ? `/remoras/${ids[0]}?hatched=1` : "/remoras");
  };
  const hatch = async () => {
    setError("");
    try {
      setStep("Preparing your copy…");
      const out = await api.hatchTx(id);
      if (!out.ok) throw new Error(out.error);
      setStep("Sign once in your wallet: its Disc and the fork record together…");
      const digest = await run(out.data.transaction);
      setSigned({ digest, ids: out.data.remoras });
      await finish(digest, out.data.remoras);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStep("");
    }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="hatch">
      <p className="text-sm text-muted-foreground">
        It's created under {shortAddress(owner)} in shadow mode. You set its budget later on its
        page; until then the template's suggestion applies, and its Disc caps every payment onchain.
      </p>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            {signed ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  void finish(signed.digest, signed.ids).catch((e) =>
                    setError((e as Error).message),
                  )
                }
              >
                Check again (already signed)
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={blocked || !!step} onClick={() => void hatch()}>
          <GitFork /> Hatch it (one signature)
        </Button>
        {step ? (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> {step}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Deprecate({ id, onDone }: { id: string; onDone: () => void }) {
  const run = useSignAndRun();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const out = await api.deprecateTx(id);
      if (!out.ok) throw new Error(out.error);
      const digest = await run(out.data.transaction);
      const done = await api.deprecateConfirm(id, digest);
      if (!done.ok) throw new Error(done.error);
      toast.success("Deprecated. It stays on Walrus, and new hatches are refused.");
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void go()}>
      {busy ? <Spinner /> : null} Deprecate
    </Button>
  );
}

export function TemplatePage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const network = useNetwork();
  const tpl = useLoad(() => api.template(id), [id]);
  const consent = useLoad(() => api.consent(id), [id]);
  const l = tpl.data?.listing;
  const c = consent.data?.consent;

  return (
    <Page title={l?.name ?? "Template"} description={l?.description ?? ""}>
      <PageHeader
        title={l?.name ?? "Template"}
        badge={
          l ? (
            <span className="flex gap-1">
              {l.deprecated ? <Badge variant="outline">deprecated</Badge> : null}
              <Badge variant="secondary" data-testid="template-forks">
                <GitFork /> {l.forks} {l.forks === 1 ? "hatch" : "hatches"}
              </Badge>
            </span>
          ) : null
        }
        description={l?.description ?? undefined}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/hatchery">All templates</Link>
          </Button>
        }
      />
      {tpl.error ? <p className="text-sm text-destructive">{tpl.error}</p> : null}
      {!l && !tpl.error ? <Skeleton className="h-48 w-full" /> : null}
      {l && params.get("published") ? (
        <Alert variant="success">
          <AlertTitle>Published</AlertTitle>
          <AlertDescription>
            Share the link below; anyone can hatch their own copy.
          </AlertDescription>
        </Alert>
      ) : null}
      {l ? (
        <Section title="Provenance" description="The file on Walrus and its author onchain.">
          <dl className="grid max-w-3xl gap-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
            <dt className="text-muted-foreground">Author</dt>
            <dd>
              <Hash value={l.author} label="author" />
            </dd>
            <dt className="text-muted-foreground">Walrus blob</dt>
            <dd data-testid="template-blob">
              <Hash value={l.blobId} href={aggregator(network, l.blobId)} label="blob" />
            </dd>
            <dt className="text-muted-foreground">Published in</dt>
            <dd>
              <Hash
                value={l.publishDigest}
                href={explorerTx(network, l.publishDigest)}
                label="transaction"
              />
            </dd>
            <dt className="text-muted-foreground">Template object</dt>
            <dd>
              <Hash value={l.templateId} label="template" />
            </dd>
            {l.parent ? (
              <>
                <dt className="text-muted-foreground">Derived from</dt>
                <dd>
                  <Link className="link" to={`/hatchery/${l.parent}`}>
                    {shortAddress(l.parent)}
                  </Link>
                </dd>
              </>
            ) : null}
            {l.stats ? (
              <>
                <dt className="text-muted-foreground">Outcomes</dt>
                <dd>
                  {l.stats.usefulAnswers} useful answers from {l.stats.hatched} hatch
                  {l.stats.hatched === 1 ? "" : "es"}
                  {l.stats.costPerUsefulUsdc ? `, ${l.stats.costPerUsefulUsdc} USDC each` : ""}
                </dd>
              </>
            ) : null}
          </dl>
          {tpl.data ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copy(tpl.data?.links.url ?? "", "Link")}
              >
                <Copy /> Copy link
              </Button>
              {tpl.data.links.telegram ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copy(tpl.data?.links.telegram ?? "", "Telegram link")}
                >
                  <Copy /> Copy Telegram link
                </Button>
              ) : null}
            </div>
          ) : null}
        </Section>
      ) : null}
      <Section
        title="Before you hatch"
        description="Read back from Walrus and checked again just now."
      >
        <div className="flex max-w-3xl flex-col gap-4" data-testid="consent">
          {consent.error ? <p className="text-sm text-destructive">{consent.error}</p> : null}
          {!c && !consent.error ? <Skeleton className="h-40 w-full" /> : null}
          {c ? (
            <>
              <PermissionsList permissions={c.permissions} />
              {c.payees.length ? (
                <ul className="flex flex-col gap-1 text-sm" aria-label="Services it may pay">
                  {c.payees.map((p) => (
                    <li key={p.ref} className="flex items-center gap-2">
                      <code className="rounded bg-muted px-1 text-xs">{p.ref}</code>
                      {p.known ? (
                        <span className="text-muted-foreground">
                          {p.priceUsdc ? `${p.priceUsdc} USDC a call` : "price unknown"}
                        </span>
                      ) : (
                        <Badge variant="destructive">not in this network's Reef</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
              <SafetyPanel report={c.safety} />
              <Alert>
                <AlertTitle>It starts in shadow mode</AlertTitle>
                <AlertDescription>
                  It shows what it would pay and pays nothing until you turn it on. Schedules arrive
                  paused; a Sentinel watches your own address.
                </AlertDescription>
              </Alert>
              {l?.deprecated ? (
                <p className="text-sm text-muted-foreground">
                  Its author deprecated it, so it can't be hatched any more.
                </p>
              ) : (
                <RequireOwner what="hatching this remora" needsWallet>
                  {(owner) => (
                    <>
                      <Hatch id={id} consent={c} owner={owner} />
                      {l && owner.toLowerCase() === l.author.toLowerCase() ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          You published this.{" "}
                          <Deprecate
                            id={id}
                            onDone={() => {
                              void tpl.refresh();
                              void consent.refresh();
                            }}
                          />
                        </div>
                      ) : null}
                    </>
                  )}
                </RequireOwner>
              )}
            </>
          ) : null}
        </div>
      </Section>
      {l ? (
        <Section
          title="Share"
          description="Put this badge in a README, blog or post. Anyone who clicks it lands on this template."
        >
          <HatchBadge templateId={id} name={l.name} />
        </Section>
      ) : null}
    </Page>
  );
}
