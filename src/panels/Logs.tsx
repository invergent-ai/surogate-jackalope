import { useEffect, useRef, useState } from "react";
import { onLog, onRunError, startMonitor } from "../lib/ipc";

export function Logs() {
  const [lines, setLines] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startMonitor(false);
    const unLog = onLog((l) => setLines((p) => [...p.slice(-1000), l]));
    const unErr = onRunError((e) => setLines((p) => [...p.slice(-1000), `ERROR: ${e}`]));
    return () => {
      unLog.then((f) => f());
      unErr.then((f) => f());
    };
  }, []);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  return (
    <div>
      <div className="panel-head">
        <h2>Logs</h2>
        <button className="ghost" onClick={() => setLines([])}>
          Clear
        </button>
      </div>
      <div className="logs logs-full" ref={ref}>
        {lines.length ? lines.join("\n") : "Waiting for run output…"}
      </div>
    </div>
  );
}
