import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { OceanEngine } from "./engine";
import type { SharkSpec } from "./world";

export type { SharkKind, SharkSpec } from "./world";

/**
 * ASCII fish schools and the sharks that hunt them, drawn on a canvas.
 * Decorative only: hidden from assistive tech, and it stays still under
 * prefers-reduced-motion. Glyphs use the canvas's font-family, hence font-mono.
 */
export function AsciiOcean({ className, sharks }: { className?: string; sharks?: SharkSpec[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The roster is fixed for the life of the canvas.
  // biome-ignore lint/correctness/useExhaustiveDependencies: sharks is read once on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    // jsdom (tests) has no layout or 2D canvas, and tests stub the observers,
    // so feature checks pass there. The ocean is decoration: skip it.
    if (!canvas || navigator.userAgent.includes("jsdom")) return;
    let engine: OceanEngine;
    try {
      engine = new OceanEngine(canvas, sharks);
    } catch {
      return;
    }
    return () => engine.destroy();
  }, []);

  return (
    <div
      aria-hidden="true"
      data-slot="ascii-ocean"
      className={cn("pointer-events-none", className)}
    >
      <canvas ref={canvasRef} className="block size-full font-mono" />
    </div>
  );
}
