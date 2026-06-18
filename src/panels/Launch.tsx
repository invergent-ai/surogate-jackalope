import { useEffect, useState } from "react";
import { cloudOptions, launchDstack, launchModal, launchSft } from "../lib/ipc";
import type { CloudOpts, Compute, SftConfig } from "../lib/types";

const TARGETS: { id: Compute; label: string }[] = [
  { id: "local", label: "Local" },
  { id: "modal", label: "Modal" },
  { id: "dstack", label: "dstack" },
];

export function Launch({ onLaunched }: { onLaunched: () => void }) {
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
  // cloud options
  const [opts, setOpts] = useState<CloudOpts | null>(null);
  const [gpuType, setGpuType] = useState("H100");
  const [gpuCount, setGpuCount] = useState(1);
  const [image, setImage] = useState("");
  const [backend, setBackend] = useState("");
  const [region, setRegion] = useState("");

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    cloudOptions().then((o) => { setOpts(o); setImage(o.modal_image); }).catch(() => {});
  }, []);

  const valid =
    c.model.trim() && c.dataset.trim() && c.output_dir.trim() && c.epochs > 0 && c.learning_rate > 0;

  async function go() {
    setErr("");
    if (!valid) {
      setErr("Fill model, dataset, output dir; epochs and lr must be > 0.");
      return;
    }
    setBusy(true);
    try {
      if (target === "local") await launchSft(c);
      else if (target === "modal") await launchModal(c, { gpu: gpuType, count: gpuCount, image });
      else await launchDstack(c, { gpu: gpuType, count: gpuCount, image, backend, region });
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

  return (
    <div>
      <div className="panel-head">
        <h2>Launch — SFT</h2>
      </div>

      <div className="seg">
        {TARGETS.map((t) => (
          <button
            key={t.id}
            className={"seg-btn" + (target === t.id ? " on" : "")}
            onClick={() => setTarget(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
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
            <input
              value={c.gpus.join(",")}
              onChange={(e) =>
                setC({
                  ...c,
                  gpus: e.target.value.split(",").map((x) => Number(x.trim())).filter((n) => !Number.isNaN(n)),
                })
              }
            />
          </>
        )}

        {(target === "modal" || target === "dstack") && (
          <>
            <div className="grid2">
              <div>
                <label>GPU type</label>
                <select value={gpuType} onChange={(e) => setGpuType(e.target.value)}>
                  {(opts?.modal_gpus ?? ["H100"]).map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
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
                {(opts?.dstack_backends ?? []).map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Region (optional)</label>
              <input value={region} onChange={(e) => setRegion(e.target.value)} />
            </div>
          </div>
        )}

        {target !== "local" && (
          <div className="dim hint">
            {target === "modal"
              ? "Runs in a Modal GPU sandbox (needs the modal client + token; uv launches the driver). Metrics stream back live; Stop terminates the sandbox."
              : "Provisions via dstack apply on your configured backend. Configure backend credentials in Providers. Stop runs dstack stop."}
          </div>
        )}

        {err && <p className="err-text">{err}</p>}
        <div className="actions">
          <button className="primary" onClick={go} disabled={busy}>
            {busy ? "Launching…" : `Launch on ${TARGETS.find((t) => t.id === target)!.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}
