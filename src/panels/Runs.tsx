import { useEffect, useState } from "react";
import { fetchArtifacts, listRuns } from "../lib/ipc";
import type { RunRecord } from "../lib/types";

export function Runs() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [fetching, setFetching] = useState<string | null>(null);
  const [note, setNote] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  useEffect(() => {
    listRuns().then(setRuns).catch(() => setRuns([]));
  }, []);

  async function fetch(id: string) {
    setFetching(id);
    setNote(null);
    try {
      const dest = await fetchArtifacts(id);
      setNote({ id, ok: true, text: `Fetched → ${dest}` });
    } catch (e) {
      setNote({ id, ok: false, text: String(e) });
    } finally {
      setFetching(null);
    }
  }

  return (
    <div>
      <div className="panel-head">
        <h2>Runs</h2>
        <button className="ghost" onClick={() => listRuns().then(setRuns)}>Refresh</button>
      </div>
      {runs.length === 0 && <p className="dim">No runs yet. Launch one from the Launch tab.</p>}
      {runs.map((r) => {
        const fetchable = !r.remote_kind || r.remote_kind === "local" || r.remote_kind === "ssh" || r.remote_kind === "modal";
        return (
          <div className="card" key={r.id}>
            <div className="run-row">
              <strong>{r.model}</strong>
              <span className="dim">{new Date(r.started_ms).toLocaleString()}</span>
            </div>
            <div className="dim run-sub">
              {r.mode} · {r.status} · {r.remote_kind || "local"} · {r.output_dir}
            </div>
            <div className="actions" style={{ marginTop: 10 }}>
              <button
                className="ghost"
                disabled={!fetchable || fetching === r.id}
                onClick={() => fetch(r.id)}
                title={fetchable ? "Fetch artifacts back to disk" : "dstack runs aren't downloadable"}
              >
                {fetching === r.id ? "Fetching…" : "Fetch artifacts"}
              </button>
            </div>
            {note && note.id === r.id && (
              <p className={note.ok ? "" : "err-text"} style={note.ok ? { color: "var(--ok-fg)", fontSize: 13 } : { fontSize: 13 }}>
                {note.text}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
