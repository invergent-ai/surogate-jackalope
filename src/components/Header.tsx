import { Brand } from "./Brand";
import { StatusBadge } from "./StatusBadge";
import type { Theme } from "../lib/theme";

export function Header({
  status,
  theme,
  onToggleTheme,
}: {
  status: string;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <Brand size={28} />
        <div className="topbar-title">
          <span className="brand-name">Jackalope</span>
          <span className="brand-sub">by Surogate</span>
        </div>
      </div>
      <div className="topbar-right">
        <StatusBadge status={status} />
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
      </div>
    </header>
  );
}
