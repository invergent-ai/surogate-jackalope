import { useEffect, useState } from "react";
import { cloudOptions, launchDstack, launchGrpo, launchModal, launchSft, launchSsh } from "../lib/ipc";
import type { CloudOpts, Compute, LaunchMode, SftConfig } from "../lib/types";

const MODES: { id: LaunchMode; label: string }[] = [
  { id: "sft", label: "SFT" },
  { id: "grpo", label: "GRPO" },
  { id: "ruler", label: "RULER" },
];
const TARGETS: { id: Compute; label: string }[] = [
  { id: "local", label: "Local" },
  { id: "ssh", label: "SSH" },
  { id: "modal", label: "Modal" },
  { id: "dstack", label: "dstack" },
];

const parseGpus = (s: string) =>
  s.split(",").map((x) => Number(x.trim())).filter((n) => !Number.isNaN(n));

export function Launch({ onLaunched }: { onLaunched: () => void }) {
  const [mode, setMode] = useState<LaunchMode>("sft");
  const [target, setTarget] = useState<Compute>("local");
  const [c, setC] = useState<SftConfig>({
    model: "Qwen/Qwen2.5-0.5B",
    dataset: "tatsu-lab/alpaca",
    output_dir: "/tmp/jackalope-run",
    precision: "bf16",
    gpus: [0],
    epochs: 1,
    learning_rate: 0.0002,
  });
  // cloud
  const [opts, setOpts] = useState<CloudOpts | null>(null);
  const [gpuType, setGpuType] = useState("H100");
  const [gpuCount, setGpuCount] = useState(1);
  const [image, setImage] = useState("");
  const [backend, setBackend] = useState("");
  const [region, setRegion] = useState("");
  // ssh
  const [sshHost, setSshHost] = useState("");
  const [sshKey, setSshKey] = useState("");
  // rl gpu split
  const [trainerGpus, setTrainerGpus] = useState("0");
  const [vllmGpus, setVllmGpus] = useState("1");
  const [judgeGpus, setJudgeGpus] = useState("2");

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    cloudOptions().then((o) => { setOpts(o); setImage(o.modal_image); }).catch(() => {});
  }, []);

  const isRL = mode === "grpo" || mode === "ruler";

  async function go() {
    setErr("");
    setBusy(true);
    try {
      if (isRL) {
        await launchGrpo(mode === "ruler", parseGpus(trainerGpus), parseGpus(vllmGpus), mode === "ruler" ? parseGpus(judgeGpus) : []);
      } else if (target === "local") {
        await launchSft(c);
      } else if (target === "ssh") {
        if (!sshHost.trim()) throw "Enter an SSH host (user@host[:port] or an ~/.ssh/config alias).";
        await launchSsh(c, { host: sshHost.trim(), port: 0, identity_file: sshKey.trim(), workdir: "" });
      } else if (target === "modal") {
        await launchModal(c, { gpu: gpuType, count: gpuCount, image });
      } else {
        await launchDstack(c, { gpu: gpuType, count: gpuCount, image, backend, region });
      }
      onLaunched();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  const setStr = (k: keyof SftConfig) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setC({ ...c, [k]: e.target.value } as SftConfig);
  const setNum = (k: keyof SftConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setC({ ...c, [k]: Number(e.target.value) } as SftConfig);

  const launchLabel = isRL
    ? `Launch ${mode.toUpperCase()} (local)`
    : `Launch on ${TARGETS.find((t) => t.id === target)!.label}`;

  return (
    <div>
      <div className="panel-head">
        <h2>Launch</h2>
      </div>

      <div className="seg">
        {MODES.map((m) => (
          <button key={m.id} className={"seg-btn" + (mode === m.id ? " on" : "")} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      {!isRL && (
        <div className="seg" style={{ marginLeft: 10 }}>
          {TARGETS.map((t) => (
            <button key={t.id} className={"seg-btn" + (target === t.id ? " on" : "")} onClick={() => setTarget(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="card">
        {isRL ? (
          <>
            <div className="dim hint">
              {mode === "grpo"
                ? "GRPO: a vLLM rollout server + the trainer on disjoint GPUs. Uses a managed config (Qwen3-0.6B + markdown-table-qa reward env)."
                : "RULER: GRPO plus a frozen LLM judge (Qwen3-1.7B) on its own GPUs — a 3-way split."}
            </div>
            <div className="grid2">
              <div>
                <label>Trainer GPUs</label>
                <input value={trainerGpus} onChange={(e) => setTrainerGpus(e.target.value)} />
              </div>
              <div>
                <label>vLLM (rollout) GPUs</label>
                <input value={vllmGpus} onChange={(e) => setVllmGpus(e.target.value)} />
              </div>
            </div>
            {mode === "ruler" && (
              <>
                <label>Judge GPUs</label>
                <input value={judgeGpus} onChange={(e) => setJudgeGpus(e.target.value)} />
              </>
            )}
          </>
        ) : (
          <>
            <label>Model</label>
            <input value={c.model} onChange={setStr("model")} placeholder="org/model or local path" />
            <label>Dataset</label>
            <input value={c.dataset} onChange={setStr("dataset")} placeholder="org/dataset or local path" />
            <label>Output directory</label>
            <input value={c.output_dir} onChange={setStr("output_dir")} />
            <label>Precision</label>
            <select value={c.precision} onChange={setStr("precision")}>
              <option value="bf16">bf16</option>
              <option value="fp8">fp8</option>
              <option value="fp16">fp16</option>
            </select>
            <div className="grid2">
              <div>
                <label>Epochs</label>
                <input type="number" step="0.1" value={c.epochs} onChange={setNum("epochs")} />
              </div>
              <div>
                <label>Learning rate</label>
                <input type="number" step="0.0001" value={c.learning_rate} onChange={setNum("learning_rate")} />
              </div>
            </div>

            {target === "local" && (
              <>
                <label>GPUs (comma-separated indices)</label>
                <input value={c.gpus.join(",")} onChange={(e) => setC({ ...c, gpus: parseGpus(e.target.value) })} />
              </>
            )}

            {target === "ssh" && (
              <>
                <label>SSH host</label>
                <input value={sshHost} onChange={(e) => setSshHost(e.target.value)} placeholder="user@host[:port] or ~/.ssh/config alias" />
                <label>Identity file (optional)</label>
                <input value={sshKey} onChange={(e) => setSshKey(e.target.value)} placeholder="~/.ssh/id_ed25519" />
                <div className="dim hint">Runs surogate in a detached tmux session and mirrors metrics back over SSH.</div>
              </>
            )}

            {(target === "modal" || target === "dstack") && (
              <>
                <div className="grid2">
                  <div>
                    <label>GPU type</label>
                    <select value={gpuType} onChange={(e) => setGpuType(e.target.value)}>
                      {(opts?.modal_gpus ?? ["H100"]).map((g) => (<option key={g} value={g}>{g}</option>))}
                    </select>
                  </div>
                  <div>
                    <label>GPU count</label>
                    <input type="number" min="1" value={gpuCount} onChange={(e) => setGpuCount(Number(e.target.value))} />
                  </div>
                </div>
                <label>Image</label>
                <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="surogate-ready docker image" />
              </>
            )}

            {target === "dstack" && (
              <div className="grid2">
                <div>
                  <label>Backend (blank = cheapest)</label>
                  <select value={backend} onChange={(e) => setBackend(e.target.value)}>
                    <option value="">cheapest</option>
                    {(opts?.dstack_backends ?? []).map((b) => (<option key={b} value={b}>{b}</option>))}
                  </select>
                </div>
                <div>
                  <label>Region (optional)</label>
                  <input value={region} onChange={(e) => setRegion(e.target.value)} />
                </div>
              </div>
            )}

            {(target === "modal" || target === "dstack") && (
              <div className="dim hint">
                {target === "modal"
                  ? "Runs in a Modal GPU sandbox (needs the modal client + token). Metrics stream back live; Stop terminates the sandbox."
                  : "Provisions via dstack apply on your configured backend. Configure credentials in Providers. Stop runs dstack stop."}
              </div>
            )}
          </>
        )}

        {err && <p className="err-text">{err}</p>}
        <div className="actions">
          <button className="primary" onClick={go} disabled={busy}>
            {busy ? "Launching…" : launchLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
