import { useEffect, useState } from "react";
import { onLog, onRunError, startMonitor } from "./ipc";

/// Subscribe to the backend `log` / `run-error` event stream, keeping the last
/// `cap` lines. Shared by the Monitor and Logs panels.
export function useLogStream(cap = 400): { lines: string[]; clear: () => void } {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    startMonitor(false);
    const unLog = onLog((l) => setLines((p) => [...p.slice(-(cap - 1)), l]));
    const unErr = onRunError((e) => setLines((p) => [...p.slice(-(cap - 1)), `ERROR: ${e}`]));
    return () => {
      unLog.then((f) => f());
      unErr.then((f) => f());
    };
  }, [cap]);
  return { lines, clear: () => setLines([]) };
}
