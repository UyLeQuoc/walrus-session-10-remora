/**
 * `/settings` (A7 + H5 + A5 + N10): your timezone, quiet hours, language and how loud remoras may be;
 * linking Telegram so they can reach you; and the panic button that pauses every remora and Disc on
 * this network with one signature.
 */
import type { OwnerSettings } from "@remora/schema";
import { OctagonX } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { useShellTitle } from "@/app/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useSignAndRun } from "@/features/funds/sign";
import { api } from "@/features/remoras/api";
import { RequireOwner, useLoad } from "@/features/remoras/hooks";

const NOTIFY: Record<OwnerSettings["notify"], string> = {
  all: "Every ping",
  important: "Only urgent ones live; the rest in the feed",
  digest: "Nothing live; read the feed",
};

function Policy() {
  const loaded = useLoad(() => api.settings(), []);
  const [s, setS] = useState<OwnerSettings | null>(null);
  useEffect(() => {
    if (loaded.data) setS(loaded.data.settings);
  }, [loaded.data]);
  if (!s) return <p className="text-sm text-muted-foreground">{loaded.error || "Loading…"}</p>;
  const save = async () => {
    const out = await api.saveSettings({
      timezone: s.timezone,
      quietStart: s.quietStart || null,
      quietEnd: s.quietEnd || null,
      language: s.language,
      notify: s.notify,
    });
    if (out.ok) toast.success("Saved.");
    else toast.error(out.error);
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="tz">Timezone</Label>
        <Input
          id="tz"
          value={s.timezone}
          onChange={(e) => setS({ ...s, timezone: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="lang">Language</Label>
        <NativeSelect
          id="lang"
          value={s.language}
          onChange={(e) => setS({ ...s, language: e.target.value as "en" | "vi" })}
        >
          <NativeSelectOption value="en">English</NativeSelectOption>
          <NativeSelectOption value="vi">Tiếng Việt</NativeSelectOption>
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="quiet-start">Quiet from</Label>
        <Input
          id="quiet-start"
          type="time"
          value={s.quietStart ?? ""}
          onChange={(e) => setS({ ...s, quietStart: e.target.value || null })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="quiet-end">Quiet until</Label>
        <Input
          id="quiet-end"
          type="time"
          value={s.quietEnd ?? ""}
          onChange={(e) => setS({ ...s, quietEnd: e.target.value || null })}
        />
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="notify">Notifications</Label>
        <NativeSelect
          id="notify"
          value={s.notify}
          onChange={(e) => setS({ ...s, notify: e.target.value as OwnerSettings["notify"] })}
        >
          {Object.entries(NOTIFY).map(([k, v]) => (
            <NativeSelectOption key={k} value={k}>
              {v}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className="text-sm text-muted-foreground">
          Urgent pings (a big outflow, a payment waiting for you) still come during quiet hours.
        </p>
      </div>
      <Button type="button" className="self-start" onClick={() => void save()}>
        Save
      </Button>
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
    <div className="flex flex-col gap-2 text-sm">
      <Button type="button" variant="outline" className="self-start" onClick={() => void make()}>
        Link Telegram
      </Button>
      {link ? (
        <p data-testid="telegram-code">
          {link.url ? (
            <a className="underline" href={link.url} target="_blank" rel="noreferrer">
              Open the bot
            </a>
          ) : (
            "Send the bot"
          )}{" "}
          {link.url ? "or send it" : ""} <code>/link {link.code}</code> within{" "}
          {link.expiresInMinutes} minutes.
        </p>
      ) : null}
    </div>
  );
}

function Panic() {
  const run = useSignAndRun();
  const [busy, setBusy] = useState(false);
  const panic = async () => {
    setBusy(true);
    try {
      const out = await api.panic();
      if (!out.ok) throw new Error(out.error);
      const digest = out.data.transaction ? await run(out.data.transaction) : undefined;
      const done = await api.panicConfirm(digest);
      if (!done.ok) throw new Error(done.error);
      toast.success(
        `Paused ${done.data.paused.length} remora${done.data.paused.length === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      type="button"
      variant="destructive"
      className="self-start"
      disabled={busy}
      onClick={() => void panic()}
    >
      <OctagonX /> {busy ? "Pausing… check your wallet" : "Pause everything"}
    </Button>
  );
}

function Settings() {
  const [params] = useSearchParams();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 overflow-y-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>When remoras may reach you, and how often.</CardDescription>
        </CardHeader>
        <CardContent>
          <Policy />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Telegram</CardTitle>
          <CardDescription>
            Talk to your remoras where you already are: /scout, /teach, /budget, and buttons on
            every message.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TelegramLink />
        </CardContent>
      </Card>
      <Card className={params.get("panic") ? "ring-2 ring-destructive" : ""}>
        <CardHeader>
          <CardTitle className="text-base">Panic button</CardTitle>
          <CardDescription>
            Pauses every remora and every Disc on this network with one signature. Resume each one
            from its page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Panic />
        </CardContent>
      </Card>
    </div>
  );
}

export function SettingsPage() {
  useShellTitle("Settings");
  return <RequireOwner what="your settings">{() => <Settings />}</RequireOwner>;
}
