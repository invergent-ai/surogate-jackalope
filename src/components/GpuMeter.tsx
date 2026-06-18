import type { GpuStat } from "../lib/types";

export function GpuMeter({ g }: { g: GpuStat }) {
  const mem = g.mem_total ? Math.round((g.mem_used / g.mem_total) * 100) : 0;
  return (
    <div className="meter">
      <div className="meter-head">
        gpu{g.index} · {g.util}% · {g.temp}°C · {g.power}W
      </div>
      <div className="bar">
        <i style={{ width: `${Math.min(g.util, 100)}%` }} />
      </div>
      <div className="meter-sub">mem {mem}%</div>
    </div>
  );
}
