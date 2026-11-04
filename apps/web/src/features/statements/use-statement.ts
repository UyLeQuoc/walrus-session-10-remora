/**
 * E6 (ADR-0122): the statement for a month (none picked yet means this month where the owner is),
 * its CSV, and printing in the light theme whatever the screen uses.
 */
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, download } from "@/features/remoras/api";
import { useNetwork } from "@/lib/network";
import { csvPath } from "./statement";

export function useStatement(month: string | null) {
  const network = useNetwork();
  return useQuery({
    queryKey: ["statement", network, month],
    queryFn: async () => {
      const r = await api.statement(month);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useCsvDownload() {
  const network = useNetwork();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (month: string) => {
    setBusy(true);
    setError("");
    const r = await download(csvPath(month), "Couldn't download the statement.");
    setBusy(false);
    if (!r.ok) return void setError(r.error);
    const url = URL.createObjectURL(r.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `remora-statement-${network}-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return { busy, error, save };
}

/** Paper is white: a dark-mode reader prints the light theme, then gets dark back. */
export function usePrintInLight() {
  useEffect(() => {
    const root = document.documentElement;
    let wasDark = false;
    const before = () => {
      wasDark = root.classList.contains("dark");
      root.classList.remove("dark");
    };
    const after = () => {
      if (wasDark) root.classList.add("dark");
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
}
