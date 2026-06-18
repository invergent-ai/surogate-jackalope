export type Tab =
  | "home"
  | "monitor"
  | "gpus"
  | "models"
  | "datasets"
  | "launch"
  | "runs"
  | "logs"
  | "files"
  | "providers"
  | "tips"
  | "settings";

// Sections mirror jackalope's terminal nav: a run you watch, the pieces you
// assemble (SET UP), the artifacts a run leaves (HISTORY), plus SYSTEM.
const SECTIONS: { title?: string; items: { id: Tab; label: string; icon: string }[] }[] = [
  {
    items: [
      { id: "home", label: "Home", icon: "◆" },
      { id: "monitor", label: "Monitor", icon: "▰" },
    ],
  },
  {
    title: "SET UP",
    items: [
      { id: "gpus", label: "GPUs", icon: "▤" },
      { id: "models", label: "Models", icon: "◈" },
      { id: "datasets", label: "Datasets", icon: "❏" },
      { id: "launch", label: "Launch", icon: "▶" },
    ],
  },
  {
    title: "HISTORY",
    items: [
      { id: "runs", label: "Runs", icon: "≡" },
      { id: "logs", label: "Logs", icon: "⌗" },
      { id: "files", label: "Files", icon: "▭" },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { id: "providers", label: "Providers", icon: "☁" },
      { id: "tips", label: "Tips", icon: "✦" },
      { id: "settings", label: "Settings", icon: "⚙" },
    ],
  },
];

const ORDER = SECTIONS.flatMap((s) => s.items);

export function Sidebar({ tab, onTab, status = "idle" }: { tab: Tab; onTab: (t: Tab) => void; status?: string }) {
  return (
    <nav className="sidebar">
      {SECTIONS.map((g, gi) => (
        <div className="navgroup" key={gi}>
          {g.title && <div className="navgroup-label">{g.title}</div>}
          {g.items.map((t) => {
            const n = ORDER.findIndex((o) => o.id === t.id) + 1;
            return (
              <button
                key={t.id}
                className={"navitem" + (tab === t.id ? " active" : "")}
                onClick={() => onTab(t.id)}
              >
                <span className="navitem-icon">{t.icon}</span>
                <span className="navitem-label">{t.label}</span>
                <span className="navitem-num">{n}</span>
              </button>
            );
          })}
        </div>
      ))}
      <div className="run-block">
        <div className="rb-label">RUN</div>
        <div className="rb-val">{status.startsWith("error") ? "error" : status}</div>
      </div>
    </nav>
  );
}
