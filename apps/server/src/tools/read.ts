/**
 * D4 read tools for a remora turn: `tatum.balances` and `tatum.objects` through Tatum gRPC, `web.fetch`
 * through the SSRF-guarded fetch, and `memory.recall`. They read and never write; whatever comes from
 * outside goes back to the model wrapped as untrusted (brain.ts).
 */
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { fetchPage } from "@remora/merchant";
import type { AnswerTools } from "../runtime/brain.ts";
import type { RemoraMemory, RemoraRef } from "../runtime/memory.ts";

const short = (coinType: string) => coinType.split("::").pop() ?? coinType;

export function readTools(o: {
  client: SuiGrpcClient;
  memory: RemoraMemory;
  remora: RemoraRef;
  fetch?: typeof fetch;
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
      const hits = await o.memory.recall(o.remora, query, ["me", "sources", "feedback", "rules"]);
      return hits.length ? hits.map((h) => `- ${h.text}`).join("\n") : "Nothing remembered.";
    },
  };
}
