import { useEffect, useState } from "react";
import { getConfig, quitApp, setConfig, surogateVersion } from "../lib/ipc";
import type { Config } from "../lib/types";
import type { Theme } from "../lib/theme";

export function Settings({
  theme,
  onToggleTheme,
  onRerunSetup,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  onRerunSetup: () => void;
}) {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getConfig().then(setCfg);
    surogateVersion().then(setVersion).catch(() => {});
  }, []);

  if (!cfg) return <div className="dim">Loading…</div>;

  const set = (k: keyof Config) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCfg({ ...cfg, [k]: e.target.value });

  async function save() {
    if (!cfg) return;
    await setConfig(cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div>
      <div className="panel-head">
        <h2>Settings</h2>
        {saved && <span className="badge ok">saved</span>}
      </div>

      <div className="card">
        <div className="card-title">Appearance</div>
        <div className="run-row">
          <span>Theme</span>
          <button className="ghost" onClick={onToggleTheme}>
            {theme === "dark" ? "☀ Light" : "☾ Dark"}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">surogate</div>
        <label>surogate binary</label>
        <input value={cfg.surogate_bin} onChange={set("surogate_bin")} />
        <div className="dim" style={{ marginTop: 6, fontSize: 13 }}>
          {version ? `detected: ${version}` : "not detected on PATH"}
        </div>
        <label>Repo root (for example configs)</label>
        <input value={cfg.repo_root} onChange={set("repo_root")} placeholder="/path/to/surogate" />
      </div>

      <div className="card">
        <div className="card-title">Paths</div>
        <label>Metrics feed file</label>
        <input value={cfg.feed_path} onChange={set("feed_path")} />
        <label>Runs directory</label>
        <input value={cfg.runs_dir} onChange={set("runs_dir")} />
      </div>

      <div className="card">
        <div className="card-title">Compute</div>
        <div className="run-row">
          <span className="dim">Current target: {cfg.compute}</span>
          <button className="ghost" onClick={onRerunSetup}>
            Re-run setup wizard
          </button>
        </div>
      </div>

      <div className="actions" style={{ display: "flex", gap: 10 }}>
        <button className="primary" onClick={save}>
          Save settings
        </button>
        <button className="danger" onClick={() => quitApp()}>
          Quit Jackalope
        </button>
      </div>
    </div>
  );
}
