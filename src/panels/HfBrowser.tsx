import { useState } from "react";
import { searchDatasets, searchModels } from "../lib/ipc";
import type { HfItem } from "../lib/types";

export function HfBrowser({ kind }: { kind: "models" | "datasets" }) {
  const [q, setQ] = useState(kind === "models" ? "qwen" : "alpaca");
  const [items, setItems] = useState<HfItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function run() {
    setBusy(true);
    setErr("");
    try {
      const fn = kind === "models" ? searchModels : searchDatasets;
      setItems(await fn(q.trim()));
      setDone(true);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="panel-head">
        <h2>{kind === "models" ? "Models" : "Datasets"}</h2>
        <span className="dim">HuggingFace Hub</span>
      </div>
      <div className="searchbar">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder={`Search ${kind} on HuggingFace…`}
        />
        <button className="primary" onClick={run} disabled={busy}>
          {busy ? "Searching…" : "Search"}
        </button>
      </div>
      {err && <div className="card err-text">{err}</div>}
      {done && !err && items.length === 0 && <div className="card dim">No results.</div>}
      <div className="hf-list">
        {items.map((it) => (
          <div className="hf-row" key={it.id}>
            <div className="hf-id">{it.id}</div>
            <div className="hf-meta dim">
              ↓ {fmtCount(it.downloads)} · ♥ {fmtCount(it.likes)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}
