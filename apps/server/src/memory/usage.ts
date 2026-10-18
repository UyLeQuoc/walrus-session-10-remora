export interface AnswerRow {
  injected: ReadonlyArray<{ blobId: string }> | null;
}

export interface MemoryUsage {
  answers: number;
  withMemory: number;
  uses: Record<string, number>;
}

export function memoryUsage(rows: readonly AnswerRow[]): MemoryUsage {
  const uses: Record<string, number> = {};
  let withMemory = 0;
  for (const row of rows) {
    const blobs = new Set((row.injected ?? []).map((item) => item.blobId));
    if (blobs.size > 0) withMemory++;
    for (const blobId of blobs) uses[blobId] = (uses[blobId] ?? 0) + 1;
  }
  return { answers: rows.length, withMemory, uses };
}
