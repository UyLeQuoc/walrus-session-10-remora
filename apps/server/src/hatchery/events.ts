/**
 * `remora_hatchery::hatchery` events (ADR-0047), decoded from a transaction's events or a
 * checkpoint's. gRPC has no event queries, so the indexer and our own confirmations both read them
 * here (ADR-0021).
 */
import { bcs } from "@mysten/sui/bcs";
import { normalizeSuiAddress } from "@mysten/sui/utils";

export const PublishedBcs = bcs.struct("Published", {
  template: bcs.Address,
  author: bcs.Address,
  blob_id: bcs.string(),
  parent: bcs.option(bcs.Address),
});
export const ForkedBcs = bcs.struct("Forked", {
  template: bcs.Address,
  author: bcs.Address,
  by: bcs.Address,
});
export const DeprecatedBcs = bcs.struct("Deprecated", {
  template: bcs.Address,
  author: bcs.Address,
});

export type HatcheryEvent =
  | {
      type: "Published";
      seq: number;
      template: string;
      author: string;
      blobId: string;
      parent: string | null;
    }
  | { type: "Forked"; seq: number; template: string; author: string; by: string }
  | { type: "Deprecated"; seq: number; template: string; author: string };

const norm = (a: string) => normalizeSuiAddress(a);

/** This package's hatchery events in a list of `{ eventType, bcs }`. */
export function decodeHatcheryEvents(
  packageId: string,
  events: { eventType?: string; bcs?: Uint8Array }[] | null | undefined,
): HatcheryEvent[] {
  const prefix = `${norm(packageId)}::hatchery::`;
  const out: HatcheryEvent[] = [];
  (events ?? []).forEach((e, seq) => {
    const [addr, rest] = (e.eventType ?? "").split(/::(.*)/s);
    if (!addr || !rest || !e.bcs) return;
    const full = `${norm(addr)}::${rest}`;
    if (!full.startsWith(prefix)) return;
    const name = full.slice(prefix.length);
    if (name === "Published") {
      const p = PublishedBcs.parse(e.bcs);
      out.push({
        type: "Published",
        seq,
        template: norm(p.template),
        author: norm(p.author),
        blobId: p.blob_id,
        parent: p.parent ? norm(p.parent) : null,
      });
    } else if (name === "Forked") {
      const f = ForkedBcs.parse(e.bcs);
      out.push({
        type: "Forked",
        seq,
        template: norm(f.template),
        author: norm(f.author),
        by: norm(f.by),
      });
    } else if (name === "Deprecated") {
      const d = DeprecatedBcs.parse(e.bcs);
      out.push({ type: "Deprecated", seq, template: norm(d.template), author: norm(d.author) });
    }
  });
  return out;
}
