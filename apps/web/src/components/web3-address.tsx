import { useEffect, useRef, useState } from "react";
import { addressFloor, fitAddress } from "@/components/fit-address";
import { cn } from "@/lib/utils";

function charsThatFit(el: HTMLElement): number | null {
  const width = el.clientWidth;
  if (width <= 0) return null;
  const style = getComputedStyle(el);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const unit = ctx.measureText("0").width;
  if (unit <= 0) return null;
  return Math.max(1, Math.floor(width / unit));
}

export function Web3Address({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [maxChars, setMaxChars] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      const next = charsThatFit(el);
      setMaxChars((prev) => (prev === next ? prev : next));
    };
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    apply();
    return () => observer.disconnect();
  }, []);

  const shown = fitAddress(value, maxChars ?? addressFloor(value));

  return (
    <span
      ref={ref}
      title={value}
      className={cn("block w-full min-w-0 overflow-hidden font-mono", className)}
    >
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
