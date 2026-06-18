export type Tab =
  | "monitor"
  | "launch"
  | "models"
  | "datasets"
  | "gpus"
  | "runs"
  | "files"
  | "providers"
  | "tips";

const GROUPS: { label: string; items: { id: Tab; label: string; icon: string }[] }[] = [
  {
    label: "Train",
    items: [
      { id: "monitor", label: "Monitor", icon: "▰" },
      { id: "launch", label: "Launch", icon: "▶" },
      { id: "runs", label: "Runs", icon: "≡" },
    ],
  },
  {
    label: "Resources",
    items: [
      { id: "models", label: "Models", icon: "◈" },
      { id: "datasets", label: "Datasets", icon: "❏" },
      { id: "files", label: "Files", icon: "▭" },
    ],
  },
  {
    label: "Compute",
    items: [
      { id: "gpus", label: "GPUs", icon: "▤" },
      { id: "providers", label: "Providers", icon: "☁" },
    ],
  },
  {
    label: "Help",
    items: [{ id: "tips", label: "Tips", icon: "✦" }],
  },
];

export function Sidebar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className="sidebar">
      {GROUPS.map((g) => (
        <div className="navgroup" key={g.label}>
          <div className="navgroup-label">{g.label}</div>
          {g.items.map((t) => (
            <button
              key={t.id}
              className={"navitem" + (tab === t.id ? " active" : "")}
              onClick={() => onTab(t.id)}
            >
              <span className="navitem-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
