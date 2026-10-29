/**
 * H6 / A8: Settings -> "Leave Remora". Export everything, then retire every remora with one
 * signature. Honest by design (F4): retiring stops spending and revokes keys, but memories live on
 * Walrus until they expire; Remora can't delete them and doesn't promise to.
 */
import type { RemoraView } from "@remora/schema";
import { Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/app/confirm-action";
import { Section } from "@/components/app/page";
import { Hash } from "@/components/hash";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSignAndRun } from "@/features/funds/sign";
import { useExport } from "@/features/me/use-export";
import { api } from "@/features/remoras/api";
import { useLoad } from "@/features/remoras/hooks";
import { useNetwork } from "@/lib/network";
import { explorerTx } from "@/lib/usdc";
import { SettingsGroup, SettingsRow } from "@/openbot/pages";
import {
  confirmRetireAll,
  exportFileName,
  fetchAccountExport,
  humanSignError,
  NotAvailableYet,
  prepareRetireAll,
} from "./account-exit";

const NOT_YET = "Not available yet. Remora hasn't turned this on; nothing was changed.";

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportEverything() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const fallback = useExport((m) => setError(m));

  const run = async () => {
    setBusy(true);
    setNote("");
    setError("");
    const name = exportFileName();
    try {
      const { text, data } = await fetchAccountExport();
      download(text, name);
      setNote(
        `Downloaded ${name}: ${data.memories.length} memories and ${data.wakes.length} Wakes (receipts).`,
      );
    } catch {
      // The full export is missing or failed: give what F8 can already export from this browser.
      const ok = await fallback.download("json", name);
      if (ok)
        setNote(
          `Downloaded ${name} with your memories only, read back from Walrus. Wakes (receipts) are not included; the full account export isn't available yet.`,
        );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsRow
      stack
      title="Export everything"
      description={
        <>
          One JSON file with your memories and your Wakes (the receipt behind each action).
          <span className="mt-1 block" role="status" data-testid="export-note">
            {note}
          </span>
          {error ? <span className="mt-1 block text-destructive">{error}</span> : null}
        </>
      }
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void run()}
        >
          {busy ? <Spinner /> : <Download aria-hidden />}
          {busy ? "Preparing…" : "Download"}
        </Button>
      }
    />
  );
}

function RetireAll({ remoras, onDone }: { remoras: RemoraView[] | null; onDone: () => void }) {
  const network = useNetwork();
  const sign = useSignAndRun();
  const [done, setDone] = useState<{ digest: string; recorded: boolean } | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const live = (remoras ?? []).filter((r) => r.status !== "retired");

  return (
    <SettingsRow
      stack
      title="Retire all remoras"
      description={
        <>
          {remoras === null ? (
            <span className="block">Loading your remoras…</span>
          ) : live.length ? (
            <>
              <span className="block">
                {live.length === 1
                  ? "This retires 1 remora:"
                  : `This retires ${live.length} remoras:`}
              </span>
              <ul className="mt-1 list-disc pl-5" aria-label="Remoras that will be retired">
                {live.map((r) => (
                  <li key={r.id}>{r.name}</li>
                ))}
              </ul>
            </>
          ) : (
            <span className="block">
              You have no active remoras, so there is nothing to retire.
            </span>
          )}
          <span className="mt-1 block">
            Retiring stops all spending and revokes every remora's key, with one signature. Your
            memories stay on Walrus until they expire; Remora can't delete them. Export first if you
            want a copy.
          </span>
          {unavailable ? (
            <span className="mt-1 block text-ob-muted" role="status">
              {NOT_YET}
            </span>
          ) : null}
          {done ? (
            <span className="mt-1 flex flex-wrap items-center gap-2" role="status">
              Retired. Transaction{" "}
              <Hash
                value={done.digest}
                href={explorerTx(network, done.digest)}
                label="transaction"
              />
              <a className="link" href={`/verify/${done.digest}`}>
                Verify it
              </a>
              {done.recorded ? null : (
                <span className="text-ob-muted">
                  Remora hasn't recorded it yet; the keys are already revoked on Sui.
                </span>
              )}
            </span>
          ) : null}
        </>
      }
      actions={
        <ConfirmAction
          disabled={remoras === null || live.length === 0}
          confirmWord="retire"
          trigger={
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={remoras === null || live.length === 0}
            >
              <Trash2 aria-hidden /> Retire all
            </Button>
          }
          title={`Retire ${live.length} remora${live.length === 1 ? "" : "s"}?`}
          description="Every remora stops for good and its key is revoked. Your wallet will ask you to sign once. Memories stay on Walrus until they expire."
          confirmLabel="Retire all"
          onConfirm={async () => {
            setUnavailable(false);
            let prepared: Awaited<ReturnType<typeof prepareRetireAll>>;
            try {
              prepared = await prepareRetireAll();
            } catch (err) {
              if (err instanceof NotAvailableYet) {
                setUnavailable(true);
                throw new Error(NOT_YET);
              }
              throw err;
            }
            let digest: string;
            try {
              digest = await sign(prepared.transaction);
            } catch (err) {
              throw new Error(humanSignError(err));
            }
            const recorded = await confirmRetireAll(digest).then(
              () => true,
              () => false,
            );
            setDone({ digest, recorded });
            onDone();
            toast.success("Every remora is retired. Your memory stays yours.");
          }}
        />
      }
    />
  );
}

export function LeaveRemora() {
  const loaded = useLoad(() => api.remoras(), []);
  return (
    <Section
      title="Leave Remora"
      tone="danger"
      layout="split"
      description="Take your data, then stop everything. Retiring can't be undone."
    >
      <SettingsGroup>
        <ExportEverything />
        {loaded.error ? (
          <SettingsRow
            stack
            title="Retire all remoras"
            description={<span className="text-destructive">{loaded.error}</span>}
          />
        ) : (
          <RetireAll remoras={loaded.data?.remoras ?? null} onDone={() => void loaded.refresh()} />
        )}
      </SettingsGroup>
    </Section>
  );
}
