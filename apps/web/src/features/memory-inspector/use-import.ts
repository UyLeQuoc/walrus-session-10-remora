/**
 * A4 (ADR-0146): the Import flow. Paste or open a file, preview the candidate lines (flagged ones
 * start unticked), tick at most 100, pick a namespace, import.
 */
import { useState } from "react";
import { type ImportCommitted, type ImportPreview, memoryApi } from "./memory-api";

const MAX_BYTES = 5 * 1024 * 1024;

export function useImport(remoraId: string, onDone: (r: ImportCommitted) => void) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [namespace, setNamespace] = useState("me");
  const [busy, setBusy] = useState<"" | "reading" | "preview" | "import">("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<ImportCommitted | null>(null);

  const max = preview?.maxTicked ?? 100;

  const reset = () => {
    setText("");
    setFileName(null);
    setPreview(null);
    setTicked(new Set());
    setError("");
    setDone(null);
  };

  const paste = (value: string) => {
    setText(value);
    setFileName(null);
  };

  const openFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("Import at most 5 MB at a time.");
    setBusy("reading");
    setError("");
    try {
      setText(await file.text());
      setFileName(file.name);
    } catch {
      setError("Couldn't read that file.");
    } finally {
      setBusy("");
    }
  };

  const runPreview = async () => {
    if (!text.trim()) return setError("Paste some text or open a file first.");
    setBusy("preview");
    setError("");
    const out = await memoryApi.importPreview(remoraId, {
      ...(fileName ? { fileName } : {}),
      text,
    });
    setBusy("");
    if (!out.ok) return setError(out.error);
    setPreview(out.data);
    setNamespace(out.data.defaultNamespace);
    setTicked(
      new Set(
        out.data.candidates
          .filter((c) => !c.flag)
          .slice(0, out.data.maxTicked)
          .map((c) => c.i),
      ),
    );
  };

  const toggle = (i: number, on: boolean) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (on && next.size < max) next.add(i);
      if (!on) next.delete(i);
      return next;
    });

  const tickNone = () => setTicked(new Set());

  const commit = async () => {
    if (!preview || !ticked.size) return;
    setBusy("import");
    setError("");
    const out = await memoryApi.importCommit(remoraId, {
      previewId: preview.previewId,
      ticked: [...ticked],
      namespace,
    });
    setBusy("");
    if (!out.ok) return setError(out.error);
    setDone(out.data);
    onDone(out.data);
  };

  return {
    text,
    fileName,
    preview,
    ticked,
    max,
    namespace,
    busy,
    error,
    done,
    paste,
    openFile,
    runPreview,
    toggle,
    tickNone,
    setNamespace,
    commit,
    reset,
  };
}
