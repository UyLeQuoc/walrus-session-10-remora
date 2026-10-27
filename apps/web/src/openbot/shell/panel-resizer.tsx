/*
 * Ported from nightly-labs/openbot packages/ui/src/components/PanelResizer.tsx and
 * src/renderer/src/WorkspaceLeftPanelResizer.tsx @ aa3c498.
 * PolyForm Noncommercial 1.0.0, see ../LICENSE.
 *
 * A vertical drag handle between two panes. With `snap`, dragging below `collapseThreshold` snaps the
 * pane to its compact width, and dragging past `expandThreshold` brings it back. Keyboard: arrows move
 * 12px, Home goes compact, End goes widest; a double click resets.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type PanelSnap = {
  compactValue: number;
  compact: boolean;
  collapseThreshold: number;
  expandThreshold: number;
  onCompactChange: (compact: boolean) => void;
};

type PanelResizerProps = {
  label: string;
  controls: string;
  /** Which side of the handle the resized pane is on. */
  direction: "left" | "right";
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  onResize: (value: number) => void;
  onResizeEnd: (value: number) => void;
  snap?: PanelSnap;
  className?: string;
};

export function PanelResizer(props: PanelResizerProps) {
  const [resizing, setResizing] = useState(false);
  const cleanup = useRef<(() => void) | null>(null);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => () => cleanup.current?.(), []);

  const clamp = (value: number) => {
    const { min, max } = latest.current;
    return Math.round(Math.min(Math.max(min, max), Math.max(min, value)));
  };
  const displayed = () =>
    latest.current.snap?.compact ? latest.current.snap.compactValue : latest.current.value;
  const resolve = (value: number) => {
    const snap = latest.current.snap;
    if (!snap) return { compact: false, value: clamp(value) };
    if (snap.compact)
      return value < snap.expandThreshold
        ? { compact: true, value: snap.compactValue }
        : { compact: false, value: clamp(value) };
    return value < snap.collapseThreshold
      ? { compact: true, value: snap.compactValue }
      : { compact: false, value: clamp(value) };
  };
  const resize = (value: number) => {
    const next = resolve(value);
    const snap = latest.current.snap;
    if (snap && next.compact !== snap.compact) snap.onCompactChange(next.compact);
    if (!next.compact) latest.current.onResize(next.value);
    return next;
  };
  const commit = (value: number) => {
    const next = resize(value);
    if (!next.compact) latest.current.onResizeEnd(next.value);
  };
  const withoutTransition = (action: () => void) => {
    document.documentElement.classList.add("panel-resizing");
    action();
    requestAnimationFrame(() => document.documentElement.classList.remove("panel-resizing"));
  };

  const beginDrag = (event: React.PointerEvent<HTMLHRElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture?.(event.pointerId);
    const startX = event.clientX;
    const startValue = displayed();
    let value = startValue;
    const sign = latest.current.direction === "left" ? 1 : -1;
    setResizing(true);
    document.documentElement.classList.add("panel-resizing");

    const move = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      value = startValue + sign * (e.clientX - startX);
      resize(value);
    };
    const finish = (e?: PointerEvent) => {
      if (e && e.pointerId !== event.pointerId) return;
      if (e) value = startValue + sign * (e.clientX - startX);
      commit(value);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      document.documentElement.classList.remove("panel-resizing");
      setResizing(false);
      cleanup.current = null;
      if (handle.hasPointerCapture?.(event.pointerId))
        handle.releasePointerCapture(event.pointerId);
    };
    const cancel = () => finish();
    cleanup.current?.();
    cleanup.current = cancel;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLHRElement>) => {
    const { snap, value, min, max, direction } = latest.current;
    let next: number | undefined;
    if (event.key === "Home") {
      event.preventDefault();
      withoutTransition(() => (snap ? snap.onCompactChange(true) : commit(min)));
      return;
    }
    if (event.key === "End") next = max;
    else if (event.key === "ArrowRight" && snap?.compact) next = min;
    else if (event.key === "ArrowLeft" && snap && !snap.compact && value <= min) {
      event.preventDefault();
      withoutTransition(() => snap.onCompactChange(true));
      return;
    } else if (event.key === "ArrowLeft") next = value + (direction === "right" ? 12 : -12);
    else if (event.key === "ArrowRight") next = value + (direction === "left" ? 12 : -12);
    if (next === undefined) return;
    event.preventDefault();
    const target = next;
    withoutTransition(() => commit(target));
  };

  return (
    <hr
      className={cn("panel-resizer", resizing && "panel-resizer-active", props.className)}
      tabIndex={0}
      aria-label={props.label}
      aria-controls={props.controls}
      aria-orientation="vertical"
      aria-valuemin={props.snap?.compactValue ?? props.min}
      aria-valuemax={props.max}
      aria-valuenow={props.snap?.compact ? props.snap.compactValue : props.value}
      aria-valuetext={
        props.snap?.compact ? `Compact, ${props.snap.compactValue}px` : `${props.value}px`
      }
      onPointerDown={beginDrag}
      onKeyDown={onKeyDown}
      onDoubleClick={(event) => {
        event.preventDefault();
        withoutTransition(() => {
          latest.current.snap?.onCompactChange(false);
          commit(latest.current.defaultValue);
        });
      }}
    />
  );
}
