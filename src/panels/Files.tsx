import { useEffect, useState } from "react";
import { listDir } from "../lib/ipc";
import type { FileEntry } from "../lib/types";

export function Files() {
  const [path, setPath] = useState<string>("/tmp");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [err, setErr] = useState("");

  function load(p: string) {
    setErr("");
    listDir(p)
      .then((e) => {
        setEntries(e);
        setPath(p);
      })
      .catch((e) => setErr(String(e)));
  }

  useEffect(() => {
    load(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parent = path.replace(/\/+$/, "").split("/").slice(0, -1).join("/") || "/";

  return (
    <div>
      <div className="panel-head">
        <h2>Files</h2>
      </div>
      <div className="searchbar">
        <input value={path} onChange={(e) => setPath(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(path)} />
        <button className="ghost" onClick={() => load(parent)}>
          ↑ Up
        </button>
      </div>
      {err && <div className="card err-text">{err}</div>}
      <div className="card file-list">
        {entries.map((e) => (
          <div
            className={"file-row" + (e.is_dir ? " dir" : "")}
            key={e.path}
            onClick={() => e.is_dir && load(e.path)}
          >
            <span className="file-name">
              {e.is_dir ? "▸ " : "  "}
              {e.name}
            </span>
            <span className="dim">{e.is_dir ? "" : fmtSize(e.size)}</span>
          </div>
        ))}
        {entries.length === 0 && !err && <div className="dim">Empty.</div>}
      </div>
    </div>
  );
}

function fmtSize(n: number): string {
  if (n >= 1 << 30) return (n / (1 << 30)).toFixed(1) + " GB";
  if (n >= 1 << 20) return (n / (1 << 20)).toFixed(1) + " MB";
  if (n >= 1 << 10) return (n / (1 << 10)).toFixed(1) + " KB";
  return n + " B";
}
