import { useEffect, useState } from "react";
import { Capabilities } from "../components/Capabilities";
import { RABBIT, TAGLINE } from "../lib/brand";
import { listGpus, listTips } from "../lib/ipc";
import type { GpuInfo, Tip } from "../lib/types";

export function Welcome({ onGo }: { onGo: (where: "launch" | "setup") => void }) {
  const [gpus, setGpus] = useState<GpuInfo[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [ti, setTi] = useState(0);

  useEffect(() => {
    listGpus().then(setGpus).catch(() => {});
    listTips().then(setTips).catch(() => {});
  }, []);
  useEffect(() => {
    if (tips.length < 2) return;
    const t = setInterval(() => setTi((p) => (p + 1) % tips.length), 7000);
    return () => clearInterval(t);
  }, [tips]);

  const gpuLine =
    gpus.length === 0
      ? "no local NVIDIA GPUs detected"
      : `${gpus.length}× ${gpus[0].name} · ${Math.round(gpus[0].mem_total / 1024)} GB`;

  return (
    <div className="welcome">
      <div className="hero">
        <pre className="ascii ascii-rabbit">{RABBIT.join("\n")}</pre>
        <div style={{ marginTop: 8 }}>
          <span className="sb-brand" style={{ fontSize: 18, fontWeight: 700 }}>jackalope</span>
          <span className="dim"> by </span>
          <span className="gold">surogate</span>
        </div>
        <div className="hero-tag">{TAGLINE}</div>
        <div className="hero-cta">
          <button className="primary" onClick={() => onGo("launch")}>launch a run</button>
          <button className="ghost" onClick={() => onGo("setup")}>run setup</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">what surogate does</div>
        <Capabilities />
      </div>

      <div className="welcome-foot">
        <span>◦ {gpuLine}</span>
        {tips.length > 0 && <span>💡 {tips[ti].title}</span>}
      </div>
    </div>
  );
}
