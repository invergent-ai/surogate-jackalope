import { Brand } from "./Brand";
import { quitApp } from "../lib/ipc";
import type { Theme } from "../lib/theme";

export function TopBar({
  status,
  theme,
  onToggleTheme,
}: {
  status: string;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const kind = status.startsWith("error")
    ? "error"
    : status === "running"
      ? "running"
      : status === "launching"
        ? "launching"
        : "idle";
  const label = status.startsWith("error") ? "error" : status;

  return (
    <header className="statusbar">
      <div className="sb-left">
        <span className="sb-logo">
          <Brand size={26} />
        </span>
        <div className="sb-title">
          <span className="sb-name">
            Jackal<b>ope</b>
          </span>
          <span className="sb-sub">by Surogate</span>
        </div>
      </div>
      <div className="sb-right">
        <span className={"status status--" + kind}>
          <span className="status__dot" />
          <span className="status__label">{label}</span>
        </span>
        <button className="icon-btn" onClick={onToggleTheme} title="Toggle light / dark">
          {theme === "dark" ? "☀" : "☾"}
        </button>
        <button className="icon-btn quit" onClick={() => quitApp()} title="Quit (Ctrl+Q)">
          ⏻
        </button>
      </div>
    </header>
  );
}
