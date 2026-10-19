/**
 * `/settings` (A7 + H5 + A5 + N10): your timezone, quiet hours, language and how loud remoras may be;
 * linking Telegram so they can reach you; and one panic action (the same hook as the header).
 */
import type { OwnerSettings } from "@remora/schema";
import { OctagonPause } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/app/confirm-action";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Hash } from "@/components/hash";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { usePanic } from "@/features/funds/use-panic";
import { api } from "@/features/remoras/api";
import { RequireOwner, useLoad } from "@/features/remoras/hooks";
import { cn } from "@/lib/utils";

const NOTIFY: Array<{
  value: OwnerSettings["notify"];
  title: string;
  body: string;
}> = [
  { value: "all", title: "All pings", body: "Every ping, as it happens." },
  {
    value: "important",
    title: "Urgent only",
    body: "Live for big outflows and payments; the rest in the feed.",
  },
  { value: "digest", title: "Digest only", body: "Nothing live; read the feed when you want." },
];

function timezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}

function Policy() {
  const loaded = useLoad(() => api.settings(), []);
  const [s, setS] = useState<OwnerSettings | null>(null);
  const [saved, setSaved] = useState<OwnerSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const zones = useMemo(timezones, []);

  useEffect(() => {
    if (loaded.data) {
      setS(loaded.data.settings);
      setSaved(loaded.data.settings);
    }
  }, [loaded.data]);

  if (!s || !saved) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const changed = JSON.stringify(s) !== JSON.stringify(saved);
  const quiet = Boolean(s.quietStart || s.quietEnd);
  const save = async () => {
    setBusy(true);
    const out = await api.saveSettings({
      timezone: s.timezone,
      quietStart: s.quietStart || null,
      quietEnd: s.quietEnd || null,
      language: s.language,
      notify: s.notify,
    });
    setBusy(false);
    if (out.ok) {
      setS(out.data.settings);
      setSaved(out.data.settings);
      toast.success("Saved.");
    } else {
      toast.error(out.error);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Combobox
            items={zones}
            value={s.timezone}
            onValueChange={(value) => value && setS({ ...s, timezone: value })}
          >
            <ComboboxInput
              id="timezone"
              aria-label="Timezone"
              placeholder="Search timezones"
              showTrigger
            />
            <ComboboxContent>
              <ComboboxEmpty>No timezone found.</ComboboxEmpty>
              <ComboboxList>
                {zones.map((zone) => (
                  <ComboboxItem key={zone} value={zone}>
                    {zone}
                  </ComboboxItem>
                ))}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="quiet-hours">Quiet hours</Label>
            <Switch
              id="quiet-hours"
              aria-label="Quiet hours"
              checked={quiet}
              onCheckedChange={(on) =>
                setS({
                  ...s,
                  quietStart: on ? (s.quietStart ?? "22:00") : null,
                  quietEnd: on ? (s.quietEnd ?? "07:00") : null,
                })
              }
            />
          </div>
          {quiet ? (
            <div className="flex items-center gap-2">
              <Input
                aria-label="Quiet from"
                type="time"
                value={s.quietStart ?? "22:00"}
                onChange={(e) => setS({ ...s, quietStart: e.target.value || null })}
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                aria-label="Quiet until"
                type="time"
                value={s.quietEnd ?? "07:00"}
                onChange={(e) => setS({ ...s, quietEnd: e.target.value || null })}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Off: remoras can reach you at any hour.</p>
          )}
          <p className="text-sm text-muted-foreground">
            Urgent pings (a big outflow, a payment waiting for you) still come during quiet hours.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="language">Language</Label>
          <Select
            value={s.language}
            onValueChange={(value) => setS({ ...s, language: value as "en" | "vi" })}
          >
            <SelectTrigger id="language" aria-label="Language" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="vi">Tiếng Việt</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>How loud</Label>
        <RadioGroup
          value={s.notify}
          onValueChange={(value) => setS({ ...s, notify: value as OwnerSettings["notify"] })}
          className="grid gap-2 sm:grid-cols-3"
        >
          {NOTIFY.map((option) => (
            <Label
              key={option.value}
              htmlFor={`notify-${option.value}`}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-lg border p-3",
                s.notify === option.value && "border-primary bg-primary/5",
              )}
            >
              <RadioGroupItem
                id={`notify-${option.value}`}
                value={option.value}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium">{option.title}</span>
                <span className="block text-sm text-muted-foreground">{option.body}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </div>

      <div className="flex items-center justify-end gap-3">
        {changed ? null : <span className="text-sm text-muted-foreground">All changes saved</span>}
        <Button
          type="button"
          variant={changed ? "default" : "outline"}
          disabled={!changed || busy}
          onClick={() => void save()}
        >
          {busy ? <Spinner /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}

function TelegramLink() {
  const [link, setLink] = useState<{
    code: string;
    url: string | null;
    expiresInMinutes: number;
  } | null>(null);
  const make = async () => {
    const out = await api.telegramLink();
    if (out.ok) setLink(out.data);
    else toast.error(out.error);
  };
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="flex items-center gap-2">
        <span className={link ? "text-warning" : "text-muted-foreground"}>
          {link ? "Code ready" : "Not linked"}
        </span>
        <span className="text-muted-foreground">
          {link
            ? "Send the code to the bot to finish."
            : "Link it to talk to remoras where you are."}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => void make()}>
          Link Telegram
        </Button>
        {link ? (
          <span data-testid="telegram-code" className="flex flex-wrap items-center gap-2">
            {link.url ? (
              <a className="link" href={link.url} target="_blank" rel="noreferrer">
                Open the bot
              </a>
            ) : (
              "Send the bot"
            )}{" "}
            <Hash value={link.code} label="link code" /> within {link.expiresInMinutes} minutes.
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Panic() {
  const { panic, remoraCount, discCount } = usePanic();
  return (
    <Section
      title="Danger zone"
      tone="danger"
      layout="split"
      description="Pauses every remora and every Disc on this network with one signature. Resume each one from its page."
    >
      <ConfirmAction
        trigger={
          <Button type="button" variant="outline" className="self-start text-destructive">
            <OctagonPause /> Pause everything
          </Button>
        }
        title="Pause all spending on testnet?"
        description={`${remoraCount} remora${remoraCount === 1 ? "" : "s"} and ${discCount} Disc${
          discCount === 1 ? "" : "s"
        } stop paying until you resume each one.`}
        confirmLabel="Pause everything"
        onConfirm={async () => {
          const message = await panic();
          toast.success(message);
        }}
      />
    </Section>
  );
}

function Settings() {
  return (
    <Page title="Settings" description="Notifications, Telegram and the panic switch.">
      <PageHeader
        title="Settings"
        description="When remoras may reach you, where, and how to stop them all."
      />
      <Section
        title="Notifications"
        description="When remoras may reach you, and how often."
        layout="split"
      >
        <Policy />
      </Section>
      <Section
        layout="split"
        title="Telegram"
        description="Talk to your remoras where you already are: /scout, /teach, /budget, and buttons on every message."
      >
        <TelegramLink />
      </Section>
      <Panic />
    </Page>
  );
}

export function SettingsPage() {
  return (
    <RequireOwner what="your settings" needsWallet>
      {() => <Settings />}
    </RequireOwner>
  );
}
