import { useEffect, useState } from "react";
import { listGpus } from "../lib/ipc";
import { gb } from "../lib/format";
import type { GpuInfo } from "../lib/types";

export function Gpus() {
  const [gpus, setGpus] = useState<GpuInfo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = () => listGpus().then((g) => { setGpus(g); setLoaded(true); }).catch(() => setLoaded(true));
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <div className="panel-head">
        <h2>GPUs</h2>
      </div>
      {loaded && gpus.length === 0 && (
        <div className="card dim">No local NVIDIA GPUs detected (nvidia-smi not available).</div>
      )}
      {gpus.map((g) => {
        const mem = g.mem_total ? Math.round((g.mem_used / g.mem_total) * 100) : 0;
        return (
          <div className="card" key={g.index}>
            <div className="run-row">
              <strong>
                gpu{g.index} · {g.name}
              </strong>
              <span className="dim">
                {g.temp}°C · {g.power}W
              </span>
            </div>
            <div className="meter" style={{ marginTop: 10 }}>
              <div className="meter-head">utilisation {g.util}%</div>
              <div className="bar">
                <i style={{ width: `${Math.min(g.util, 100)}%` }} />
              </div>
            </div>
            <div className="meter" style={{ marginTop: 10 }}>
              <div className="meter-head">
                memory {mem}% · {gb(g.mem_used)}/{gb(g.mem_total)} GB
              </div>
              <div className="bar">
                <i className="purple" style={{ width: `${mem}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
