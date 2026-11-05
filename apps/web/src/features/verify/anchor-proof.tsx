/**
 * ADR-0139: where a Wake that didn't pay is anchored. "Anchored in <digest>, proof of N steps", then
 * the three checks this browser ran itself; before its hourly batch, "Not anchored yet".
 */
import type { AnchorProof, Wake } from "@remora/schema";
import { Checks, Digest } from "@/components/visual";
import { type AnchorCheck, useAnchorCheck } from "./use-anchor-check";

const steps = (n: number) => `${n} step${n === 1 ? "" : "s"}`;

function items(check: AnchorCheck | null, proof: AnchorProof) {
  const reading = !check || check.state === "checking";
  const event = check?.state === "done" ? check.event : null;
  return [
    {
      label: "Its proof reaches the anchored root",
      state: check?.proofOk ? ("pass" as const) : check ? ("fail" as const) : ("pending" as const),
      detail: `Hashed here: ${steps(proof.proof.length)} to root ${proof.root.slice(0, 16)}…`,
    },
    {
      label: "The root is onchain",
      state: reading
        ? ("pending" as const)
        : check.state === "error"
          ? ("skip" as const)
          : event
            ? ("pass" as const)
            : ("fail" as const),
      detail:
        check?.state === "error"
          ? check.message
          : event
            ? `Read from Sui: ${event.count} records, anchored ${new Date(event.atMs).toLocaleString()}`
            : reading
              ? "Reading the transaction from Sui…"
              : "No Anchored event with this root in that transaction.",
    },
    {
      label: "Its own key anchored it",
      state:
        check?.state === "done"
          ? check.byRemora
            ? ("pass" as const)
            : ("skip" as const)
          : ("pending" as const),
      detail: event ? event.anchorer : "The event names who anchored it.",
    },
  ];
}

export function AnchorProofCard({ wake, anchor }: { wake: Wake; anchor: AnchorProof | null }) {
  const check = useAnchorCheck(wake, anchor);
  if (!anchor)
    return (
      <p className="text-sm text-ob-secondary" data-testid="anchor-proof">
        Not anchored yet. What a remora does without paying is anchored on Sui in hourly batches.
      </p>
    );
  return (
    <div className="flex max-w-3xl flex-col gap-3" data-testid="anchor-proof">
      <p className="flex flex-wrap items-center gap-1.5 text-sm text-ob-secondary">
        Anchored in <Digest value={anchor.digest} network={anchor.network} />, proof of{" "}
        {steps(anchor.proof.length)}.
      </p>
      <Checks label="Anchor checks" items={items(check, anchor)} />
    </div>
  );
}
