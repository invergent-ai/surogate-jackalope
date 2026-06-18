import { useEffect, useState, type ComponentType } from "react";
import { LossScene, ModelsScene, GpusScene, UtilScene, ThroughputScene, SpeedupScene } from "./scenes";

// A rotating "what training looks like" panel — modeled on the way PostHog's
// wizard cycles showcase content on its side panel, and ported from surogate's
// Ink `Showcase`. Each scene animates on its own; the carousel advances every
// few seconds with a title + progress dots. The active scene is keyed by index
// so its entrance animation replays every time it comes back around.
const SCENES: { title: string; sub: string; El: ComponentType }[] = [
  { title: "TRAINING LOSS", sub: "live", El: LossScene },
  { title: "TRAINABLE MODELS", sub: "Hugging Face", El: ModelsScene },
  { title: "EVERY NVIDIA GPU", sub: "sm80 – sm120", El: GpusScene },
  { title: "GPU UTILIZATION", sub: "4× H100", El: UtilScene },
  { title: "THROUGHPUT", sub: "tok/s", El: ThroughputScene },
  { title: "PRECISION RECIPES", sub: "speed of light", El: SpeedupScene },
];
const PERIOD = 6000;

export function Showcase() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % SCENES.length), PERIOD);
    return () => clearInterval(id);
  }, []);

  const scene = SCENES[i]!;
  const Scene = scene.El;
  return (
    <div className="sc">
      <div className="sc-head">
        <span className="sc-name">{scene.title}</span>
        <span className="sc-sub">{scene.sub}</span>
      </div>
      <div className="sc-stage">
        <Scene key={i} />
      </div>
      <div className="sc-dots">
        {SCENES.map((s, k) => (
          <button
            key={s.title}
            className={"sc-dot" + (k === i ? " on" : "")}
            onClick={() => setI(k)}
            aria-label={s.title}
          />
        ))}
      </div>
    </div>
  );
}
