/**
 * ADR-0121: a remora's hooks, on its Settings tab.
 * - **Price:** wake it when SUI, WAL, BTC or ETH crosses a price (checked every 5 minutes, unpaid).
 * - **Webhook:** a URL that wakes it on a signed POST; GitHub's own signature works as it is.
 * - **Tell other apps:** URLs told about its payments, answers, approvals, proposals and price
 *   hikes, signed, with Send test and the last deliveries.
 */
import { HOOK_EVENTS, type HookEvent, type RemoraView } from "@remora/schema";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Pause,
  Play,
  Plus,
  RotateCw,
  Send,
  Trash2,
  TrendingUp,
  Webhook,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Section } from "@/components/app/page";
import { Time } from "@/components/app/time";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Problem, StatusDot } from "@/components/visual";
import { SettingsGroup, SettingsRow } from "@/openbot/pages";
import type { Delivery, PriceTriggerView } from "./hooks-api";
import { OUT_SECRET, useRemoraHooks } from "./use-remora-hooks";

const EVENT_LABEL: Record<HookEvent, string> = {
  "payment.settled": "Paid",
  "approval.asked": "Asks you",
  "answer.ready": "Answered",
  "proposal.made": "Proposes",
  "price.hike": "Price hike",
};

function Part({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-medium text-ob-secondary [&_svg]:size-4">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function SecretLine({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <code className="min-w-0 flex-1 text-xs [overflow-wrap:anywhere]" data-testid="hook-secret">
        {value}
      </code>
      <CopyButton value={value} label={label} variant="ghost" />
    </span>
  );
}

const priceLine = (t: PriceTriggerView) => (
  <span className="flex flex-wrap items-center gap-1.5 tabular-nums">
    <b>{t.symbol}</b>
    {t.above !== null ? (
      <span className="flex items-center">
        <ArrowUp className="size-3.5" aria-hidden />
        <span className="sr-only">above</span> {t.above}
      </span>
    ) : null}
    {t.below !== null ? (
      <span className="flex items-center">
        <ArrowDown className="size-3.5" aria-hidden />
        <span className="sr-only">below</span> {t.below}
      </span>
    ) : null}
    {t.usd !== null ? <span className="text-ob-muted">· now {t.usd}</span> : null}
    {t.paused ? <Badge variant="outline">paused</Badge> : null}
  </span>
);

const deliveryState = (d: Delivery) =>
  d.status === "ok" ? "ok" : d.status === "refused" ? "off" : "down";

export function HooksCard({ r }: { r: RemoraView }) {
  const h = useRemoraHooks(r.id);
  const [symbol, setSymbol] = useState("SUI");
  const [side, setSide] = useState<"above" | "below">("below");
  const [threshold, setThreshold] = useState("");
  const [sender, setSender] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<HookEvent[]>(["payment.settled", "answer.ready"]);
  if (h.loadError) return <Problem title="Can't load its hooks right now." detail={h.loadError} />;
  const v = h.view;
  if (!v) return null;
  const price = Number(threshold);
  const outSecret = h.secrets[OUT_SECRET];

  return (
    <Section
      layout="split"
      title="Hooks"
      description="Wake it from outside, and tell other apps what it did."
      hint="A price trigger is checked every 5 minutes and wakes it once per crossing. A webhook wakes it on a POST signed with its secret; the body is data for the answer, never instructions. Outbound hooks are signed (Remora-Signature: t=…,v1=HMAC-SHA256 of t.body); reject anything more than 5 minutes old."
    >
      <div className="flex flex-col gap-6" data-testid="hooks-card">
        {(v.prices ?? v.wakes) ? (
          <Part icon={<TrendingUp />} title="Wake on a price">
            <SettingsGroup
              as="ul"
              className={v.price.length ? "" : "hidden"}
              aria-label="Price triggers"
            >
              {v.price.map((t) => (
                <SettingsRow
                  as="li"
                  key={t.id}
                  size="compact"
                  title={priceLine(t)}
                  actions={
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={t.paused ? `Turn on ${t.symbol}` : `Pause ${t.symbol}`}
                        disabled={h.busy === `price:${t.id}`}
                        onClick={() => void h.pausePrice(t.id, !t.paused)}
                      >
                        {t.paused ? <Play /> : <Pause />}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove ${t.symbol}`}
                        disabled={h.busy === `price:${t.id}`}
                        onClick={() => void h.removePrice(t.id)}
                      >
                        <Trash2 />
                      </Button>
                    </>
                  }
                />
              ))}
            </SettingsGroup>
            <div className="flex flex-wrap items-center gap-2">
              <NativeSelect
                aria-label="Asset"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              >
                {v.symbols.map((s) => (
                  <NativeSelectOption key={s} value={s}>
                    {s}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect
                aria-label="Direction"
                value={side}
                onChange={(e) => setSide(e.target.value === "above" ? "above" : "below")}
              >
                <NativeSelectOption value="below">goes below</NativeSelectOption>
                <NativeSelectOption value="above">goes above</NativeSelectOption>
              </NativeSelect>
              <Input
                aria-label="Price in USD"
                className="w-28"
                inputMode="decimal"
                placeholder="0.85"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
              <Button
                type="button"
                disabled={!(price > 0) || h.busy === "price:add"}
                onClick={() =>
                  void h.addPrice(symbol, side, price).then((ok) => ok && setThreshold(""))
                }
              >
                {h.busy === "price:add" ? <Spinner /> : <Plus />} Add
              </Button>
            </div>
          </Part>
        ) : null}

        {v.wakes ? (
          <Part icon={<Webhook />} title="Wake on a webhook">
            <SettingsGroup
              as="ul"
              className={v.inbound.length ? "" : "hidden"}
              aria-label="Webhooks"
            >
              {v.inbound.map((w) => {
                const secret = h.secrets[w.id];
                return (
                  <SettingsRow
                    as="li"
                    key={w.id}
                    size="compact"
                    stack
                    title={
                      <span className="flex min-w-0 items-center gap-2">
                        {w.name ? <Badge variant="secondary">{w.name}</Badge> : null}
                        <code
                          className="min-w-0 flex-1 text-xs [overflow-wrap:anywhere]"
                          data-testid="hook-url"
                        >
                          {w.url}
                        </code>
                        <CopyButton value={w.url} label="webhook URL" variant="ghost" />
                      </span>
                    }
                    description={
                      secret ? <SecretLine value={secret} label="webhook secret" /> : null
                    }
                    actions={
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={h.busy === `in:${w.id}`}
                          onClick={() => (secret ? h.hide(w.id) : void h.revealWebhook(w.id))}
                        >
                          {secret ? <EyeOff /> : <Eye />} {secret ? "Hide" : "Secret"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label="Rotate webhook"
                          disabled={h.busy === `in:${w.id}`}
                          onClick={() => void h.rotateWebhook(w.id)}
                        >
                          <RotateCw />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label="Remove webhook"
                          disabled={h.busy === `in:${w.id}`}
                          onClick={() => void h.removeWebhook(w.id)}
                        >
                          <Trash2 />
                        </Button>
                      </>
                    }
                  />
                );
              })}
            </SettingsGroup>
            <div className="flex flex-wrap items-center gap-2">
              <NativeSelect
                aria-label="Sender"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
              >
                <NativeSelectOption value="">Any sender</NativeSelectOption>
                <NativeSelectOption value="github">GitHub</NativeSelectOption>
              </NativeSelect>
              <Button
                type="button"
                variant="outline"
                disabled={h.busy === "in:add"}
                onClick={() => void h.addWebhook(sender || undefined)}
              >
                {h.busy === "in:add" ? <Spinner /> : <Plus />} New webhook
              </Button>
            </div>
          </Part>
        ) : null}

        <Part icon={<Send />} title="Tell other apps">
          <SettingsGroup
            as="ul"
            className={v.out.length ? "" : "hidden"}
            aria-label="Outbound hooks"
          >
            {v.out.map((o) => (
              <SettingsRow
                as="li"
                key={o.id}
                size="compact"
                title={<span className="text-xs [overflow-wrap:anywhere]">{o.url}</span>}
                description={
                  <span className="flex flex-wrap gap-1">
                    {o.events.map((e) => (
                      <Badge key={e} variant="outline">
                        {EVENT_LABEL[e]}
                      </Badge>
                    ))}
                  </span>
                }
                actions={
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={h.busy === `out:${o.id}`}
                      onClick={() => void h.testOut(o.id)}
                    >
                      {h.busy === `out:${o.id}` ? <Spinner /> : <Send />} Send test
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label="Remove URL"
                      disabled={h.busy === `out:${o.id}`}
                      onClick={() => void h.removeOut(o.id)}
                    >
                      <Trash2 />
                    </Button>
                  </>
                }
              />
            ))}
          </SettingsGroup>
          <div className="flex flex-col gap-2">
            <Input
              aria-label="URL to send to"
              placeholder="https://example.com/remora"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <legend className="sr-only">Events</legend>
              {HOOK_EVENTS.map((e) => (
                <label
                  key={e}
                  className="flex items-center gap-1.5 text-sm"
                  htmlFor={`hook-${r.id}-${e}`}
                >
                  <Checkbox
                    id={`hook-${r.id}-${e}`}
                    checked={events.includes(e)}
                    onCheckedChange={(on) =>
                      setEvents((x) => (on === true ? [...x, e] : x.filter((y) => y !== e)))
                    }
                  />
                  {EVENT_LABEL[e]}
                </label>
              ))}
              <Button
                type="button"
                className="ml-auto"
                disabled={!url.trim() || !events.length || h.busy === "out:add"}
                onClick={() => void h.addOut(url.trim(), events).then((ok) => ok && setUrl(""))}
              >
                {h.busy === "out:add" ? <Spinner /> : <Plus />} Add
              </Button>
            </fieldset>
          </div>
          {v.out.length ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ob-muted">Signing secret</span>
              {outSecret ? <SecretLine value={outSecret} label="signing secret" /> : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={h.busy === OUT_SECRET}
                onClick={() => (outSecret ? h.hide(OUT_SECRET) : void h.revealOutSecret())}
              >
                {outSecret ? <EyeOff /> : <Eye />} {outSecret ? "Hide" : "Show"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label="Rotate signing secret"
                disabled={h.busy === OUT_SECRET}
                onClick={() => void h.rotateOutSecret()}
              >
                <RotateCw />
              </Button>
            </div>
          ) : null}
          {v.deliveries.length ? (
            <ul className="flex flex-col divide-y divide-ob-border" aria-label="Deliveries">
              {v.deliveries.map((d) => (
                <li
                  key={`${d.id}:${d.hookId}:${d.attempt}:${d.at}`}
                  className="flex flex-wrap items-center gap-2 py-1.5 text-sm tabular-nums"
                  data-testid="hook-delivery"
                >
                  <StatusDot state={deliveryState(d)} label={d.status} />
                  <span className="font-medium">{d.type}</span>
                  <span className="text-ob-muted">
                    {d.code ?? d.error ?? d.status} · {d.ms} ms
                    {d.attempt > 1 ? ` · try ${d.attempt}` : ""}
                  </span>
                  <Time value={d.at} className="ml-auto text-ob-muted" />
                </li>
              ))}
            </ul>
          ) : null}
        </Part>
        {h.tested ? (
          <p className="text-sm" data-testid="hook-tested">
            Test:{" "}
            {h.tested.status === "ok"
              ? `${h.tested.code} in ${h.tested.ms} ms`
              : (h.tested.error ?? `answered ${h.tested.code}`)}
          </p>
        ) : null}
        {h.error ? <p className="text-md text-ob-danger-text">{h.error}</p> : null}
      </div>
    </Section>
  );
}
