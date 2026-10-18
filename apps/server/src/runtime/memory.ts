/**
 * F1/A3 (ADR-0030): a remora's memory, in namespaces of the operator's Walrus Memory account.
 * `me` is shared by the owner's remoras; everything else is the remora's own. Writes go through the
 * port, which redacts credentials first (I5/F11a) and settles in the background (~24 s).
 */

import type { Logger } from "@remora/chain";
import { createMemoryPort, type MemoryPort, type MemoryType } from "@remora/memory";

export interface RemoraRef {
  id: string;
  name: string;
  ownerAddress: string;
}

export interface Recalled {
  blobId: string;
  namespace: string;
  text: string;
  distance: number;
}

export interface RemoraMemory {
  recall(r: RemoraRef, query: string, namespaces: string[], limit?: number): Promise<Recalled[]>;
  remember(
    r: RemoraRef,
    ns: string,
    type: MemoryType,
    text: string,
  ): Promise<{ saved: boolean; note: string }>;
}

/** Public on chain: ids only, never names or handles (packages/schema NAMESPACES). */
export const namespaceFor = (r: RemoraRef, ns: string) =>
  ns === "me" ? `owner:${r.ownerAddress.toLowerCase()}:me` : `remora:${r.id}:${ns}`;

export function createRemoraMemory(
  operator: { key: string; accountId: string; serverUrl: string },
  log: Logger,
): RemoraMemory {
  const ports = new Map<string, MemoryPort>();
  const port = (r: RemoraRef, ns: string) => {
    const namespace = namespaceFor(r, ns);
    let p = ports.get(namespace);
    if (!p) {
      p = createMemoryPort({
        scope: { mode: "guest", ...operator, namespace },
        by: r.name,
        channel: "remora",
      });
      ports.set(namespace, p);
    }
    return p;
  };
  return {
    async recall(r, query, namespaces, limit = 5) {
      const out: Recalled[] = [];
      for (const ns of namespaces) {
        try {
          const hits = await port(r, ns).recall({ query: query.slice(0, 300), limit });
          out.push(
            ...hits.map((h) => ({
              blobId: h.blob_id,
              namespace: ns,
              text: h.text,
              distance: h.distance,
            })),
          );
        } catch (err) {
          log.warn("memory.recall_failed", { remora: r.id, ns, error: err });
        }
      }
      return out.sort((a, b) => a.distance - b.distance).slice(0, limit * 2);
    },
    async remember(r, ns, type, text) {
      const res = await port(r, ns).remember({ type, text, channel: "remora" });
      return { saved: res.saved, note: res.note };
    },
  };
}
