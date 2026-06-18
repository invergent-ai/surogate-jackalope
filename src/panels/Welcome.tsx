import { useEffect, useState } from "react";
import { Capabilities } from "../components/Capabilities";
import { RABBIT, TAGLINE } from "../lib/brand";
import { gb } from "../lib/format";
import { useRotatingTips } from "../lib/useRotatingTips";
import { listGpus } from "../lib/ipc";
import type { GpuInfo } from "../lib/types";

export function Welcome({ onGo }: { onGo: (where: "launch" | "setup") => void }) {
  const [gpus, setGpus] = useState<GpuInfo[]>([]);
  const { tip } = useRotatingTips();

  useEffect(() => {
    listGpus().then(setGpus).catch(() => {});
  }, []);

  const gpuLine =
    gpus.length === 0
      ? "no local NVIDIA GPUs detected"
      : `${gpus.length}× ${gpus[0].name} · ${gb(gpus[0].mem_total)} GB`;

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
        {tip && <span>💡 {tip.title}</span>}
      </div>
    </div>
  );
}
