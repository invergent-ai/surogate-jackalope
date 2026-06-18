import type { Theme } from "../lib/theme";
import { quitApp } from "../lib/ipc";

export function TopBar({
  status,
  theme,
  onToggleTheme,
}: {
  status: string;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const live = status === "running";
  const launching = status === "launching";
  const err = status.startsWith("error");
  return (
    <div className="statusbar">
      <div className="sb-left">
        <span className="sb-brand">◆ jackalope</span>
        <span className="sb-sep">·</span>
        <span className="sb-recipe">by surogate</span>
      </div>
      <div className="sb-right">
        <span className={err ? "badge err" : live ? "live" : launching ? "paused" : "sb-run"}>
          {err ? status.split("\n")[0] : live ? "● live" : launching ? "◐ launching" : "○ idle"}
        </span>
        <button className="sb-toggle" onClick={onToggleTheme} title="toggle theme">
          {theme === "dark" ? "☀" : "☾"}
        </button>
        <button className="sb-toggle sb-quit" onClick={() => quitApp()} title="quit (Ctrl+Q)">
          ⏻
        </button>
      </div>
    </div>
  );
}
