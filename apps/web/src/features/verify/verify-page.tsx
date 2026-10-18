/**
 * `/verify/:ref` (G3·ui): anyone with a transaction digest or a Wake id can check a remora's receipt
 * against the chain: the intent hash, the `Paid` anchor, the payee's balance change, and who signed.
 * No sign-in needed: it only reads public chain data and the stored Wake.
 */
import type { VerifyResult } from "@remora/schema";
import { CheckCircle2, CircleMinus, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useShellTitle } from "@/app/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/features/remoras/api";
import { WakeDetails } from "@/features/remoras/why-drawer";

export function VerifyPage() {
  useShellTitle("Verify");
  const { ref = "" } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(ref);
  const [state, setState] = useState<{
    result: VerifyResult | null;
    error: string;
    loading: boolean;
  }>({
    result: null,
    error: "",
    loading: false,
  });
  useEffect(() => {
    if (!ref) return;
    setState({ result: null, error: "", loading: true });
    void api
      .verify(ref)
      .then((r) =>
        setState(
          r.ok
            ? { result: r.data, error: "", loading: false }
            : { result: null, error: r.error, loading: false },
        ),
      );
  }, [ref]);
  const r = state.result;
  const allOk = r ? r.checks.every((c) => c.ok !== false) : false;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 overflow-y-auto p-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) navigate(`/verify/${input.trim()}`);
        }}
      >
        <Input
          aria-label="Digest or Wake id"
          placeholder="Transaction digest or Wake id"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit">Verify</Button>
      </form>
      {state.loading ? (
        <p className="text-sm text-muted-foreground">Reading the chain through Tatum…</p>
      ) : null}
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {r ? (
        <>
          <p className="flex items-center gap-2 text-sm" data-testid="verify-verdict">
            {allOk ? (
              <Badge>verified</Badge>
            ) : (
              <Badge variant="destructive">does not check out</Badge>
            )}
            {r.anchored ? (
              <Badge variant="secondary">anchored onchain</Badge>
            ) : (
              <Badge variant="outline">not anchored</Badge>
            )}
          </p>
          <ul className="flex flex-col gap-2 text-sm" aria-label="Checks">
            {r.checks.map((c) => (
              <li key={c.name} className="flex items-start gap-2">
                {c.ok === null ? (
                  <CircleMinus className="size-4 text-muted-foreground" />
                ) : c.ok ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : (
                  <XCircle className="size-4 text-destructive" />
                )}
                <span>
                  <span className="font-medium">{c.name}</span>{" "}
                  <span className="break-all text-muted-foreground">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          <WakeDetails
            view={{
              wakeBlobId: null,
              intentHash: r.checks[0]?.detail ?? "",
              anchored: r.anchored,
              wake: r.wake,
            }}
          />
        </>
      ) : null}
    </div>
  );
}
