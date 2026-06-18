import { useEffect, useRef, useState } from "react";
import { searchDatasets, searchModels } from "../lib/ipc";
import type { HfItem } from "../lib/types";

const fmt = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : String(n));

export function HfBrowser({ kind }: { kind: "models" | "datasets" }) {
  const [q, setQ] = useState(kind === "models" ? "qwen" : "alpaca");
  const [items, setItems] = useState<HfItem[]>([]);
  const [sel, setSel] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // debounced search, jackalope-style
  useEffect(() => {
    const fn = kind === "models" ? searchModels : searchDatasets;
    setStatus("loading");
    const t = setTimeout(() => {
      fn(q.trim() || "the")
        .then((r) => { setItems(r); setSel(0); setStatus("idle"); })
        .catch((e) => { setErr(String(e)); setStatus("error"); });
    }, 300);
    return () => clearTimeout(t);
  }, [q, kind]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { setSel((i) => Math.min(items.length - 1, i + 1)); e.preventDefault(); }
    else if (e.key === "ArrowUp") { setSel((i) => Math.max(0, i - 1)); e.preventDefault(); }
  }

  return (
    <div>
      <div className="panel-head">
        <h2>{kind === "models" ? "models" : "datasets"}</h2>
        <span className="dim">huggingface · {status === "loading" ? "searching…" : `${items.length} results`}</span>
      </div>
      <div className="browse-search">
        <span className="prompt">&gt;</span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder={`search ${kind} on huggingface…`}
        />
      </div>
      {status === "error" && <div className="card err-text">↳ {err}</div>}
      <div className="browse-list">
        {items.map((it, i) => (
          <button
            key={it.id}
            className={"browse-row" + (i === sel ? " on" : "")}
            onClick={() => setSel(i)}
          >
            <span className="browse-id">{it.id}</span>
            <span className="browse-meta">↓ {fmt(it.downloads)}  ♥ {fmt(it.likes)}</span>
          </button>
        ))}
        {status === "idle" && items.length === 0 && <div className="dim">no results</div>}
      </div>
    </div>
  );
}
