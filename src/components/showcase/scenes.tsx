import { useFrame } from "./useFrame";
import { MODELS, GPU_GENS, RECIPES, RECIPE_MAX } from "./data";

// ── Training loss ──────────────────────────────────────────────────────────
// A synthetic loss curve: exponential decay with a touch of early wobble that
// fades out as the run "settles". The SVG path is precomputed once; the line
// draws in via CSS (stroke-dashoffset) and the readout ticks down via useFrame.
const LW = 240; // svg coordinate width
const LH = 88; // svg coordinate height
const N = 44; // sample points
const HI = 1.95; // loss at step 0
const LO = 0.34; // loss at the end

// value(i) ∈ [0,1]: 1 = high loss (top), 0 = converged (bottom).
function lossValue(i: number): number {
  const t = i / (N - 1);
  const decay = Math.exp(-i / 10);
  const wobble = 0.06 * Math.sin(i * 1.6) * (1 - t);
  return Math.max(0, Math.min(1, decay + wobble));
}

const LOSS = Array.from({ length: N }, (_, i) => lossValue(i));
const PAD = 6;
const PTS = LOSS.map((v, i) => {
  const x = (i / (N - 1)) * LW;
  const y = PAD + (1 - v) * (LH - PAD * 2);
  return [x, y] as const;
});
const LOSS_PATH = PTS.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const AREA_PATH = `${LOSS_PATH} L${LW},${LH} L0,${LH} Z`;

export function LossScene() {
  const f = useFrame(105);
  const cursor = Math.min(f, N - 1);
  const loss = LO + (HI - LO) * LOSS[cursor]!;
  const [hx, hy] = PTS[cursor]!;
  return (
    <div className="sc-loss">
      <svg viewBox={`0 0 ${LW} ${LH}`} preserveAspectRatio="none" className="sc-chart">
        <line className="sc-grid" x1="0" y1={LH * 0.33} x2={LW} y2={LH * 0.33} />
        <line className="sc-grid" x1="0" y1={LH * 0.66} x2={LW} y2={LH * 0.66} />
        <path className="sc-area" d={AREA_PATH} />
        <path className="sc-loss-line" d={LOSS_PATH} />
        <circle className="sc-lead" cx={hx} cy={hy} r="3" />
      </svg>
      <div className="sc-meta">
        <span>loss </span>
        <b className="sc-hot">{loss.toFixed(2)}</b>
        <span className="sc-down"> ▼</span>
        <span className="sc-dim">{`   step ${cursor + 1}/${N} · lr 2.0e-4 · bf16`}</span>
      </div>
    </div>
  );
}

// ── Trainable models ─────────────────────────────────────────────────────────
export function ModelsScene() {
  const f = useFrame(900);
  const hi = f % MODELS.length;
  return (
    <div className="sc-rows">
      {MODELS.map((m, i) => (
        <div key={m.name} className={"sc-mrow" + (i === hi ? " on" : "")} style={{ animationDelay: `${i * 60}ms` }}>
          <span className="sc-arrow">▸</span>
          <b>{m.name}</b>
          <span className="sc-mz">{m.meta}</span>
        </div>
      ))}
    </div>
  );
}

// ── Every NVIDIA GPU ───────────────────────────────────────────────────────
export function GpusScene() {
  return (
    <div className="sc-chips">
      {GPU_GENS.map((g, i) => (
        <span key={g.name} className="sc-chip" style={{ animationDelay: `${i * 55}ms` }}>
          <b>{g.name}</b>
          <span className="sc-csub">{g.sub}</span>
        </span>
      ))}
      <span className="sc-chip wide" style={{ animationDelay: `${GPU_GENS.length * 55}ms` }}>
        multi-GPU · multi-node
      </span>
    </div>
  );
}

// ── GPU utilization ──────────────────────────────────────────────────────────
const TEMPS = [72, 69, 70, 67];
const WATTS = [248, 240, 244, 236];
export function UtilScene() {
  const f = useFrame(150);
  return (
    <div className="sc-gpus">
      {[0, 1, 2, 3].map((g) => {
        const util = Math.max(62, Math.min(99, 88 + 10 * Math.sin(f * 0.24 + g * 1.3)));
        return (
          <div className="sc-gpu" key={g}>
            <div className="sc-gt">
              {`gpu${g}`} · <b>{Math.round(util)}%</b> · {TEMPS[g]}°C · {WATTS[g]}W
            </div>
            <div className="sc-bar">
              <i style={{ width: `${util}%` }} className={g % 2 ? "alt" : ""} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Throughput ───────────────────────────────────────────────────────────────
const SPARK_N = 34;
export function ThroughputScene() {
  const f = useFrame(115);
  const vals = Array.from({ length: SPARK_N }, (_, i) => {
    const x = f - (SPARK_N - 1 - i);
    return Math.max(0.12, Math.min(1, 0.56 + 0.18 * Math.sin(x * 0.24) + 0.09 * Math.sin(x * 1.3)));
  });
  const cur = Math.round(11200 + 2800 * vals[SPARK_N - 1]!);
  return (
    <div className="sc-thru">
      <div className="sc-spark">
        {vals.map((v, i) => (
          <i key={i} style={{ height: `${Math.round(v * 100)}%`, opacity: 0.35 + 0.65 * (i / SPARK_N) }} />
        ))}
      </div>
      <div className="sc-meta">
        <span>throughput </span>
        <b className="sc-hot">{cur.toLocaleString()}</b>
        <span className="sc-dim"> tok/s · sample packing · fused cross-entropy</span>
      </div>
    </div>
  );
}

// ── Precision recipes ────────────────────────────────────────────────────────
export function SpeedupScene() {
  const f = useFrame(55);
  const grow = Math.min(1, f / 38); // fill in, then hold
  return (
    <div className="sc-recipes">
      {RECIPES.map((r) => {
        const w = (r.x / RECIPE_MAX) * grow * 100;
        return (
          <div className="sc-recipe" key={r.name}>
            <div className="sc-rname">
              <b>{r.name}</b>
              <span className="sc-rsub">{r.sub}</span>
            </div>
            <div className="sc-bar">
              <i style={{ width: `${w}%`, background: r.color }} />
            </div>
            <span className="sc-rx">{(r.x * grow).toFixed(1)}×</span>
          </div>
        );
      })}
      <div className="sc-meta sc-dim">Full FT · LoRA · QLoRA · GRPO RL · CPU offload · MoE</div>
    </div>
  );
}
