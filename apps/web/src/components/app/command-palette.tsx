/**
 * N7: a global search over the pages, the signed-in owner's remoras and rooms, and a few actions,
 * drawn as openbot's global search (ADR-0069). Cmd+K on Mac, Ctrl+K elsewhere opens it. It reads
 * only the lists the roster already loads (no new API); a signed-out owner or a failed list just
 * shows no remoras or rooms group.
 */
import {
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  Hash,
  type LucideIcon,
  Plus,
  Search,
  SquarePen,
} from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { RAIL_FOOTER, RAIL_PAGES } from "@/app/app-rail";
import { RemoraAvatar } from "@/components/app/remora-avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/features/remoras/api";
import { useLoad, useOwner } from "@/features/remoras/hooks";

// The same pages as the rail (app-rail.tsx), Connections included, then the actions.
const PAGES = [...RAIL_PAGES, ...RAIL_FOOTER];
const ACTIONS = [
  { to: "/chat", label: "New chat", icon: SquarePen },
  { to: "/remoras/new", label: "New remora", icon: Plus },
] as const;

type Group = "Pages" | "Remoras" | "Rooms" | "Actions";

interface Result {
  key: string;
  label: string;
  to: string;
  group: Group;
  icon?: LucideIcon;
  detail?: string;
  avatar?: { id: string; name: string };
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
  const rooms = useLoad(
    () =>
      owner ? api.rooms() : Promise.resolve({ ok: true as const, data: { rooms: [] as never[] } }),
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
      .filter((r) => r.status !== "retired" && matches(r.name))
      .map((r) => ({
        key: `remora:${r.id}`,
        label: r.name,
        to: `/remoras/${r.id}`,
        group: "Remoras",
        detail: r.template,
        avatar: { id: r.id, name: r.name },
      }));
    const shared: Result[] = (rooms.data?.rooms ?? [])
      .filter((room) => matches(room.name))
      .map((room) => ({
        key: `room:${room.id}`,
        label: room.name,
        to: `/chat/room/${room.id}`,
        group: "Rooms",
        icon: Hash,
      }));
    const actions: Result[] = ACTIONS.filter((a) => matches(a.label)).map((a) => ({
      key: `action:${a.to}`,
      label: a.label,
      to: a.to,
      group: "Actions",
      icon: a.icon,
    }));
    return [...pages, ...mine, ...shared, ...actions];
  }, [query, remoras.data, rooms.data]);

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
  const groups = (["Pages", "Remoras", "Rooms", "Actions"] as const).filter((g) =>
    results.some((r) => r.group === g),
  );

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent
        className="global-search-dialog top-[112px] flex w-[min(640px,calc(100vw-32px))] max-w-none translate-y-0 flex-col gap-0 overflow-hidden rounded-ob-card border-0 bg-ob-control p-0 shadow-[0_0_0_1px_var(--openbot-dialog-ring),var(--openbot-shadow-overlay)] sm:max-w-none"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search pages and remoras</DialogTitle>
          <DialogDescription>Type to filter, then press Enter to open.</DialogDescription>
        </DialogHeader>
        <div className="global-search-control">
          <Search aria-hidden />
          <input
            autoFocus
            className="global-search-input"
            aria-label="Search pages and remoras"
            placeholder="Search pages, remoras and rooms"
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
          className="global-search-results"
        >
          {results.length === 0 ? (
            <p className="global-search-empty">No matches</p>
          ) : (
            groups.map((group) => (
              <div key={group} role="presentation">
                <p className="global-search-section">{group}</p>
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
                      className="global-search-result"
                    >
                      <span className="global-search-icon">
                        {result.avatar ? (
                          <RemoraAvatar id={result.avatar.id} size={20} still />
                        ) : result.icon ? (
                          <result.icon aria-hidden />
                        ) : null}
                      </span>
                      <span className="global-search-result-title">{result.label}</span>
                      <span className="global-search-result-detail">{result.detail}</span>
                      <CornerDownLeft aria-hidden className="global-search-result-enter size-3.5" />
                    </button>
                  ) : null,
                )}
              </div>
            ))
          )}
        </div>
        <p className="global-search-footer">
          <span className="inline-flex items-center gap-0.5">
            <ArrowUp aria-hidden className="size-3" />
            <ArrowDown aria-hidden className="size-3" /> to move
          </span>
          <span>Enter to open</span>
          <span>Esc to close</span>
        </p>
      </DialogContent>
    </Dialog>
  );
}
