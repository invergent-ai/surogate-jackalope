import type { Tab } from "./Sidebar";

const HINTS: Record<Tab, [string, string][]> = {
  home: [["⏎", "launch a run"], ["t", "theme"]],
  monitor: [["x", "stop"], ["p", "pause"], ["t", "theme"]],
  launch: [["click", "change value"], ["⏎/g", "launch"], ["esc", "cancel edit"]],
  runs: [["f", "fetch artifacts"], ["⏎", "watch"]],
  logs: [["clear", "reset"]],
  models: [["type", "search"], ["⏎", "select"]],
  datasets: [["type", "search"], ["⏎", "select"]],
  gpus: [["auto", "refresh 2s"]],
  files: [["▸", "open dir"], ["↑", "up"]],
  providers: [["save", "configure backend"]],
  tips: [["✦", "grounded in surogate docs"]],
  settings: [["save", "persist"]],
};

export function HintBar({ tab, status }: { tab: Tab; status: string }) {
  const hints = HINTS[tab] ?? [];
  return (
    <div className="hintbar">
      <div className="hintbar-left">
        {hints.map(([k, l]) => (
          <span key={k}>
            <span className="hint-k">{k}</span>
            <span className="hint-l">{l}</span>
          </span>
        ))}
      </div>
      <div className="hintbar-right">
        {tab} · {status.split("\n")[0]}
      </div>
    </div>
  );
}
