import { useLayoutEffect, useRef, useState } from "react";
import { interpolatePull, prefersReducedMotion, settingsAnimMs } from "../lib/settingsSheet";

/** Interpolate the sheet from wherever it is. Never jumps to the destination first. */
export function useVisualSettingsPull(storePull: number, tracking: boolean): number {
  const [visual, setVisual] = useState(storePull);
  const visualRef = useRef(storePull);

  useLayoutEffect(() => {
    if (tracking) {
      visualRef.current = storePull;
      setVisual(storePull);
      return;
    }
    const from = visualRef.current;
    const to = storePull;
    if (Math.abs(from - to) < 0.0005) {
      visualRef.current = to;
      setVisual(to);
      return;
    }
    setVisual(from);
    const reduced = prefersReducedMotion();
    const dur = settingsAnimMs(reduced);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const next = interpolatePull(from, to, t, reduced);
      visualRef.current = next;
      setVisual(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [storePull, tracking]);

  return tracking ? storePull : visual;
}
