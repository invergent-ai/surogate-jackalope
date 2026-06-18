import { useEffect, useState } from "react";

// A bare frame counter — the Ink `Showcase` pattern, ported to the web runtime.
// Every `ms` it bumps an integer; scenes derive their motion from it (bar widths,
// sparkline phase, loss cursor). Because the value is recomputed each render,
// state-driven scenes can never get "stuck" the way fire-once CSS animations can.
//
// Under prefers-reduced-motion we don't tick — but we start at a *settled* high
// frame instead of 0, so scenes render their finished state (bars full, loss
// converged) rather than a meaningless zero state (empty bars, "step 1/44").
const SETTLED = 1000;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export function useFrame(ms: number): number {
  const reduce = prefersReducedMotion();
  const [f, setF] = useState(reduce ? SETTLED : 0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setF((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms, reduce]);
  return f;
}
