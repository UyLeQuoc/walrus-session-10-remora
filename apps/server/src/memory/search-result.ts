import { explorer, type RecalledMemory } from "@remora/memory";

export interface SearchResult {
  mine: boolean;
  text: string;
  type: string | null;
  relevance: number;
  blobId: string;
  explorerUrl: string;
}

const AUTHOR_TAG = /\[by:[^\]]*\]\s*/g;

export function searchResult(hit: RecalledMemory, mine: ReadonlySet<string>): SearchResult {
  return {
    mine: mine.has(hit.blob_id),
    text: hit.parsed?.text ?? hit.text.replace(AUTHOR_TAG, ""),
    type: hit.parsed?.type ?? null,
    relevance: Number((1 - hit.distance).toFixed(2)),
    blobId: hit.blob_id,
    explorerUrl: explorer.blobExplorer(hit.blob_id),
  };
}
