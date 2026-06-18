import { useEffect, useState } from "react";
import { Brand } from "../components/Brand";
import { Capabilities } from "../components/Capabilities";
import { TAGLINE } from "../lib/brand";
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
        <div className="hero-logo">
          <Brand size={84} />
        </div>
        <h1 className="hero-title">
          Jackalope <span className="by">by Surogate</span>
        </h1>
        <div className="hero-tag">{TAGLINE}</div>
        <div className="hero-cta">
          <button className="primary" onClick={() => onGo("launch")}>Launch a run</button>
          <button className="ghost" onClick={() => onGo("setup")}>Run setup</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">What surogate does</div>
        <Capabilities />
      </div>

      <div className="welcome-foot">
        <span>{gpuLine}</span>
        {tip && <span>💡 {tip.title}</span>}
      </div>
    </div>
  );
}
