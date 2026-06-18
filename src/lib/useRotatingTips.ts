import { useEffect, useState } from "react";
import { listTips } from "./ipc";
import type { Tip } from "./types";

/// Load the curated tips once and rotate through them. Shared by the Tips rail
/// and the Welcome footer.
export function useRotatingTips(intervalMs = 7000): { tips: Tip[]; tip: Tip | undefined; index: number; setIndex: (i: number) => void } {
  const [tips, setTips] = useState<Tip[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    listTips().then(setTips).catch(() => setTips([]));
  }, []);
  useEffect(() => {
    if (tips.length < 2) return;
    const t = setInterval(() => setIndex((p) => (p + 1) % tips.length), intervalMs);
    return () => clearInterval(t);
  }, [tips, intervalMs]);

  return { tips, tip: tips[index], index, setIndex };
}
