/**
 * N7: a global search over the pages and the signed-in owner's remoras. Cmd+K on Mac, Ctrl+K
 * elsewhere opens it. It reads only the remoras list the Remoras page already loads (no new API),
 * and a signed-out owner or a failed list just shows no remoras group.
 */
import { Brain, Fish, Inbox, type LucideIcon, Wallet } from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/features/remoras/api";
import { useLoad, useOwner } from "@/features/remoras/hooks";

// The same items as the sidebar's navigation (app-sidebar.tsx).
const PAGES = [
  { to: "/", label: "Home", icon: Fish },
  { to: "/approvals", label: "Approvals", icon: Inbox },
  { to: "/funds", label: "Funds", icon: Wallet },
  { to: "/memory", label: "Memory", icon: Brain },
] as const;

interface Result {
  key: string;
  label: string;
  to: string;
  group: "Pages" | "Remoras";
  icon?: LucideIcon;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const { owner } = useOwner();
  const remoras = useLoad(
    () =>
      owner
        ? api.remoras()
        : Promise.resolve({ ok: true as const, data: { remoras: [] as never[] } }),
    [owner],
  );

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const hit = isMac ? event.metaKey : event.ctrlKey;
      if (hit && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo<Result[]>(() => {
    const needle = query.trim().toLowerCase();
    const matches = (label: string) => label.toLowerCase().includes(needle);
    const pages: Result[] = PAGES.filter((p) => matches(p.label)).map((p) => ({
      key: `page:${p.to}`,
      label: p.label,
      to: p.to,
      group: "Pages",
      icon: p.icon,
    }));
    const mine: Result[] = (remoras.data?.remoras ?? [])
      .filter((r) => matches(r.name))
      .map((r) => ({
        key: `remora:${r.id}`,
        label: r.name,
        to: `/remoras/${r.id}`,
        group: "Remoras",
      }));
    return [...pages, ...mine];
  }, [query, remoras.data]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(0);
  };

  const go = (result: Result) => {
    close();
    navigate(result.to);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const picked = results[active];
      if (picked) go(picked);
    }
  };

  const current = results.length ? Math.min(active, results.length - 1) : -1;
  const groups = (["Pages", "Remoras"] as const).filter((g) => results.some((r) => r.group === g));

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent
        className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search pages and remoras</DialogTitle>
          <DialogDescription>Type to filter, then press Enter to open.</DialogDescription>
        </DialogHeader>
        <div className="border-b p-2">
          <Input
            autoFocus
            aria-label="Search pages and remoras"
            placeholder="Search pages and remoras"
            value={query}
            aria-controls="command-palette-results"
            aria-activedescendant={
              current >= 0 ? `command-palette-${results[current].key}` : undefined
            }
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        <div
          id="command-palette-results"
          role="listbox"
          aria-label="Results"
          className="max-h-80 overflow-y-auto p-2"
        >
          {results.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">No matches</p>
          ) : (
            groups.map((group) => (
              <div key={group} role="presentation" className="pb-2 last:pb-0">
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{group}</p>
                {results.map((result, index) =>
                  result.group === group ? (
                    <button
                      key={result.key}
                      type="button"
                      id={`command-palette-${result.key}`}
                      role="option"
                      aria-selected={index === current}
                      tabIndex={-1}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => go(result)}
                      className={`flex w-full cursor-pointer items-center rounded-md px-2 py-2 text-left text-sm ${
                        index === current ? "bg-accent text-accent-foreground" : ""
                      }`}
                    >
                      {result.icon ? <result.icon className="mr-2 size-4 shrink-0" /> : null}
                      <span className="min-w-0 flex-1 truncate">{result.label}</span>
                    </button>
                  ) : null,
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
