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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useSignAndRun } from "@/features/funds/sign";
import { api } from "@/features/remoras/api";
import { RequireOwner, useLoad } from "@/features/remoras/hooks";
import { useNetwork } from "@/lib/network";
import { explorerTx } from "@/lib/usdc";
import { Property, PropertyList } from "@/openbot/pages";
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
  // ADR-0131: the template's public starter memories this owner chose to start with.
  const [pack, setPack] = useState<string[]>([]);
  const blocked = consent.safety.verdict === "block" || consent.listing.deprecated;

  const finish = async (digest: string, ids: string[]) => {
    setStep("Confirming onchain…");
    const done = await api.hatchConfirm(id, digest, ids, pack);
    if (!done.ok) throw new Error(done.error);
    setSigned(null);
    toast.success(
      "Your copy is ready. It starts in practice mode: it shows what it would pay, and pays nothing.",
    );
    navigate(ids[0] ? `/remoras/${ids[0]}?hatched=1` : "/remoras");
  };
  const hatch = async () => {
    setError("");
    try {
      setStep("Preparing your copy…");
      const out = await api.hatchTx(id);
      if (!out.ok) throw new Error(out.error);
      setStep("Sign once in your wallet: its spending limit and the copy record together…");
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
      <p className="text-md text-ob-muted">
        It's created under {shortAddress(owner)} in practice mode. You set its budget later on its
        page; until then the template's suggestion applies, and its spending limit caps every
        payment onchain.
      </p>
      {consent.team.pack?.length ? (
        <fieldset className="flex flex-col gap-1.5" data-testid="hatch-pack">
          <legend className="mb-1 text-md font-medium">
            Start with its author's public memories? Pick any.
          </legend>
          {consent.team.pack.map((t, i) => (
            <div key={t} className="flex items-start gap-2 text-sm">
              <Checkbox
                id={`pack-${i}`}
                aria-label={`Start with: ${t.slice(0, 60)}`}
                checked={pack.includes(t)}
                onCheckedChange={(on) =>
                  setPack((p) => (on ? [...p, t] : p.filter((x) => x !== t)))
                }
              />
              <label htmlFor={`pack-${i}`} data-ux-skip>
                {t}
              </label>
            </div>
          ))}
        </fieldset>
      ) : null}
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
          <GitFork /> Use it (one signature)
        </Button>
        {step ? (
          <span className="flex items-center gap-2 text-md text-ob-muted">
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
      toast.success("Deprecated. It stays on Walrus, and new copies are refused.");
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
                <GitFork /> {l.forks} {l.forks === 1 ? "copy" : "copies"}
              </Badge>
            </span>
          ) : null
        }
        description={l?.description ?? undefined}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link to="/hatchery">All templates</Link>
            </Button>
            {/* ADR-0103: the main action is reachable from the top, only when it can be used. */}
            {c && c.safety.verdict !== "block" && !c.listing.deprecated ? (
              <Button asChild size="sm">
                <a href="#use">
                  <GitFork /> Use it
                </a>
              </Button>
            ) : c ? (
              <Badge variant="destructive">blocked</Badge>
            ) : null}
          </>
        }
      />
      {tpl.error ? <p className="text-md text-ob-danger-text">{tpl.error}</p> : null}
      {!l && !tpl.error ? <Skeleton className="h-48 w-full rounded-ob-card" /> : null}
      {l && params.get("published") ? (
        <Alert variant="success">
          <AlertTitle>Published</AlertTitle>
          <AlertDescription>Share the link below; anyone can make their own copy.</AlertDescription>
        </Alert>
      ) : null}
      <Section title="Before you use it" hint="Read back from Walrus and checked again just now.">
        <div className="flex max-w-3xl scroll-mt-6 flex-col gap-4" data-testid="consent" id="use">
          {consent.error ? <p className="text-md text-ob-danger-text">{consent.error}</p> : null}
          {!c && !consent.error ? <Skeleton className="h-40 w-full rounded-ob-card" /> : null}
          {c ? (
            <>
              <PermissionsList permissions={c.permissions} />
              {c.payees.length ? (
                <ul className="ob-group" aria-label="Services it may pay">
                  {c.payees.map((p) => (
                    <li
                      key={p.ref}
                      className="flex min-h-10 flex-wrap items-center justify-between gap-2 px-4 py-2 text-md"
                    >
                      <code className="font-mono text-xs text-ob-text">{p.ref}</code>
                      {p.known ? (
                        <span className="text-ob-muted tabular-nums">
                          {p.priceUsdc ? `${p.priceUsdc} USDC a call` : "price unknown"}
                        </span>
                      ) : (
                        <Badge variant="destructive">not a service on this network</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
              <SafetyPanel report={c.safety} />
              <Alert>
                <AlertTitle>It starts in practice mode</AlertTitle>
                <AlertDescription>
                  It shows what it would pay and pays nothing until you turn it on. Schedules arrive
                  paused; a Wallet watcher watches your own address.
                </AlertDescription>
              </Alert>
              {l?.deprecated ? (
                <p className="text-md text-ob-muted">
                  Its author deprecated it, so no new copies can be made.
                </p>
              ) : (
                <RequireOwner what="using this remora" needsWallet>
                  {(owner) => (
                    <>
                      <Hatch id={id} consent={c} owner={owner} />
                      {l && owner.toLowerCase() === l.author.toLowerCase() ? (
                        <div className="flex items-center gap-2 text-md text-ob-muted">
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
        <Section title="Provenance" hint="The file on Walrus and its author onchain.">
          <PropertyList className="max-w-3xl">
            <Property term="Author">
              <Hash value={l.author} label="author" />
            </Property>
            <Property term="Walrus blob" data-testid="template-blob">
              <Hash value={l.blobId} href={aggregator(network, l.blobId)} label="blob" />
            </Property>
            <Property term="Published in">
              <Hash
                value={l.publishDigest}
                href={explorerTx(network, l.publishDigest)}
                label="transaction"
              />
            </Property>
            <Property term="Template object">
              <Hash value={l.templateId} label="template" />
            </Property>
            {l.parent ? (
              <Property term="Derived from">
                <Link className="link" to={`/hatchery/${l.parent}`}>
                  {shortAddress(l.parent)}
                </Link>
              </Property>
            ) : null}
            {l.stats ? (
              <Property term="Outcomes">
                {l.stats.usefulAnswers} useful answers from {l.stats.hatched}{" "}
                {l.stats.hatched === 1 ? "copy" : "copies"}
                {l.stats.costPerUsefulUsdc ? `, ${l.stats.costPerUsefulUsdc} USDC each` : ""}
              </Property>
            ) : null}
          </PropertyList>
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
