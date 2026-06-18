import { useEffect, useState } from "react";
import { listRuns } from "../lib/ipc";
import type { RunRecord } from "../lib/types";

export function Runs() {
  const [runs, setRuns] = useState<RunRecord[]>([]);

  useEffect(() => {
    listRuns().then(setRuns).catch(() => setRuns([]));
  }, []);

  return (
    <div>
      <div className="panel-head">
        <h2>Runs</h2>
        <button className="ghost" onClick={() => listRuns().then(setRuns)}>
          Refresh
        </button>
      </div>
      {runs.length === 0 && <p className="dim">No runs yet. Launch one from the Launch tab.</p>}
      {runs.map((r) => (
        <div className="card" key={r.id}>
          <div className="run-row">
            <strong>{r.model}</strong>
            <span className="dim">{new Date(r.started_ms).toLocaleString()}</span>
          </div>
          <div className="dim run-sub">
            {r.mode} · {r.status} · {r.output_dir}
          </div>
        </div>
      ))}
    </div>
  );
}
