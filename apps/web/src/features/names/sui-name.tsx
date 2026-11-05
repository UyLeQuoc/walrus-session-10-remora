/**
 * C1 (ADR-0144): an address with its `.sui` name beside it, when it has one. Lookups are batched
 * (one request per 50 ms of renders) and cached for the page's life; the server caches an hour.
 * The address stays one tap away (the copy button and the full value on hover).
 */
import { useEffect, useState } from "react";
import { z } from "zod";
import { Hash } from "@/components/hash";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

const cache = new Map<string, string | null>();
const waiting = new Map<string, ((n: string | null) => void)[]>();
let pending = false;
const later = () => {
  if (pending) return;
  pending = true;
  setTimeout(() => void flush(), 50);
};

const norm = (a: string) => `0x${a.replace(/^0x/i, "").toLowerCase().padStart(64, "0")}`;

async function flush() {
  pending = false;
  const batch = [...waiting.keys()].slice(0, 50);
  const done = (names: Record<string, string>) => {
    for (const a of batch) {
      const n = names[a] ?? null;
      cache.set(a, n);
      for (const cb of waiting.get(a) ?? []) cb(n);
      waiting.delete(a);
    }
    if (waiting.size) later();
  };
  try {
    const res = await apiFetch(`/api/names?addresses=${batch.join(",")}`);
    const body = z.object({ names: z.record(z.string(), z.string()) }).safeParse(await res.json());
    done(body.success ? body.data.names : {});
  } catch {
    done({});
  }
}

export function useSuiName(address: string | null | undefined): string | null {
  const key = address && /^0x[0-9a-fA-F]{1,64}$/.test(address) ? norm(address) : null;
  const [name, setName] = useState<string | null>(key ? (cache.get(key) ?? null) : null);
  useEffect(() => {
    if (!key) return;
    if (cache.has(key)) {
      setName(cache.get(key) ?? null);
      return;
    }
    let live = true;
    waiting.set(key, [...(waiting.get(key) ?? []), (n) => live && setName(n)]);
    later();
    return () => {
      live = false;
    };
  }, [key]);
  return name;
}

/** An address, with its name first when it has one. */
export function NamedAddress({
  value,
  href,
  label = "address",
}: {
  value: string;
  href?: string | null;
  label?: string;
}) {
  const name = useSuiName(value);
  return (
    <span className="flex min-w-0 max-w-full items-center gap-1.5">
      {name ? (
        <Badge variant="secondary" className="shrink-0" data-testid="sui-name">
          {name}
        </Badge>
      ) : null}
      <Hash value={value} href={href ?? null} label={label} />
    </span>
  );
}
