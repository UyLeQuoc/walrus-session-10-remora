import { useState } from "react";
import { apiFetch, errorMessage } from "@/lib/api";

export type ExportFormat = "md" | "json";

export interface ExportCoverage {
  memories: number;
  withText: number;
  verified: number;
}

export function useExport(onError: (message: string) => void) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [coverage, setCoverage] = useState<ExportCoverage | null>(null);

  const download = async (format: ExportFormat) => {
    setBusy(format);
    try {
      const res = await apiFetch(`/api/me/export?format=${format}`);
      if (!res.ok) throw new Error(await errorMessage(res, `The export failed (${res.status}).`));
      const content = await res.text();
      if (format === "json") {
        const parsed = JSON.parse(content) as { coverage?: ExportCoverage };
        if (parsed.coverage) setCoverage(parsed.coverage);
      }
      const name =
        /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ??
        `hippo-memory.${format}`;
      const url = URL.createObjectURL(
        new Blob([content], { type: res.headers.get("content-type") ?? "" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      onError(err instanceof Error ? err.message : "The export failed.");
    } finally {
      setBusy(null);
    }
  };

  return { busy, coverage, download };
}
