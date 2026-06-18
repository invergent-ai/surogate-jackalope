export type Tab = "monitor" | "launch" | "runs";

const TABS: { id: Tab; label: string }[] = [
  { id: "monitor", label: "Monitor" },
  { id: "launch", label: "Launch" },
  { id: "runs", label: "Runs" },
];

export function Sidebar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className="sidebar">
      <div className="brand">◆ Jackalope</div>
      {TABS.map((t) => (
        <button
          key={t.id}
          className={"navitem" + (tab === t.id ? " active" : "")}
          onClick={() => onTab(t.id)}
        >
          {t.label}
        </button>
      ))}
      <div className="sidebar-foot">surogate dashboard</div>
    </nav>
  );
}
