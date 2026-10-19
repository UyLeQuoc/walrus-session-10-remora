/** A memory the server says it recalled for an answer; `TurnTrace` lists them under the answer. */
export interface RecalledMemory {
  type: string;
  text: string;
  relevance: number;
  blobId: string;
}
