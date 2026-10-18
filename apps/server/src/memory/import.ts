import { type ImportedFact, importRequest, parseImportedFacts } from "@remora/core/import-facts";
import type { RememberFactResult } from "./remember-fact.ts";

export interface ImportTally {
  saved: number;
  known: number;
  failed: number;
}

export async function findImportFacts(
  pasted: string,
  today: string,
  complete: (request: { system: string; prompt: string }) => Promise<string>,
): Promise<ImportedFact[]> {
  return parseImportedFacts(await complete(importRequest(pasted, today)));
}

export async function keepImportedFacts(
  facts: readonly ImportedFact[],
  remember: (fact: ImportedFact) => Promise<RememberFactResult>,
): Promise<ImportTally> {
  const tally: ImportTally = { saved: 0, known: 0, failed: 0 };
  for (const fact of facts) {
    const result = await remember(fact).catch((err: unknown) => {
      console.error("[import] keep failed", err instanceof Error ? err.name : "error");
      return null;
    });
    if (!result?.ok) tally.failed++;
    else if (result.saved) tally.saved++;
    else tally.known++;
  }
  return tally;
}
