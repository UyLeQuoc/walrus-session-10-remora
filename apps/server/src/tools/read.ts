/**
 * D4 read tools for a remora turn: `tatum.balances` and `tatum.objects` through Tatum gRPC, `web.fetch`
 * through the SSRF-guarded fetch, and `memory.recall`. They read and never write; whatever comes from
 * outside goes back to the model wrapped as untrusted (brain.ts). `memory.recall` goes through the same
 * admission as the turn's own recall (F15): what no longer holds is replaced by what does.
 */
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { fetchPage } from "@remora/merchant";
import type { AnswerTools } from "../runtime/brain.ts";
import { admitMemories, type FactLedger } from "../runtime/facts.ts";
import type { RemoraMemory, RemoraRef } from "../runtime/memory.ts";

const short = (coinType: string) => coinType.split("::").pop() ?? coinType;

export function readTools(o: {
  client: SuiGrpcClient;
  memory: RemoraMemory;
  remora: RemoraRef;
  fetch?: typeof fetch;
  facts?: FactLedger;
}): Pick<AnswerTools, "balances" | "object" | "fetch" | "recall"> {
  return {
    async balances(address) {
      const { balances } = await o.client.core.listBalances({ owner: address });
      if (!balances.length) return `${address} holds nothing.`;
      return balances
        .map((b) => `${short(b.coinType)}: ${b.balance} (address balance ${b.addressBalance})`)
        .join("\n");
    },
    async object(id) {
      const { object } = await o.client.core.getObject({ objectId: id });
      return JSON.stringify({
        id,
        type: object.type,
        version: object.version,
        owner: object.owner,
      });
    },
    async fetch(url) {
      return (await fetchPage(url, o.fetch ? { fetch: o.fetch } : {})).slice(0, 6_000);
    },
    async recall(query) {
      const namespaces = ["me", "sources", "feedback", "rules"];
      const hits = await o.memory.recall(o.remora, query, namespaces);
      const { memories, facts } = await admitMemories(
        o.facts ? { facts: o.facts } : {},
        o.remora,
        query,
        hits,
        namespaces,
      );
      const lines = [...memories.map((h) => `- ${h.text}`), ...facts.map((f) => `- now: ${f}`)];
      return lines.length ? lines.join("\n") : "Nothing remembered.";
    },
  };
}
