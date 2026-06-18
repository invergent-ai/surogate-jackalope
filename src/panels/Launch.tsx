import { useState } from "react";
import { launchSft } from "../lib/ipc";
import type { SftConfig } from "../lib/types";

export function Launch({ onLaunched }: { onLaunched: () => void }) {
  const [c, setC] = useState<SftConfig>({
    model: "Qwen/Qwen2.5-0.5B",
    dataset: "tatsu-lab/alpaca",
    output_dir: "/tmp/jackalope-run",
    precision: "bf16",
    gpus: [0],
    epochs: 1,
    learning_rate: 0.0002,
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const valid =
    c.model.trim() &&
    c.dataset.trim() &&
    c.output_dir.trim() &&
    c.epochs > 0 &&
    c.learning_rate > 0 &&
    c.gpus.length > 0;

  async function go() {
    setErr("");
    if (!valid) {
      setErr("Fill model, dataset, output dir and at least one GPU; epochs and lr must be > 0.");
      return;
    }
    setBusy(true);
    try {
      await launchSft(c);
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
        <h2>Launch — SFT (local)</h2>
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

        <label>GPUs (comma-separated indices)</label>
        <input
          value={c.gpus.join(",")}
          onChange={(e) =>
            setC({
              ...c,
              gpus: e.target.value
                .split(",")
                .map((x) => Number(x.trim()))
                .filter((n) => !Number.isNaN(n)),
            })
          }
        />

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

        {err && <p className="err-text">{err}</p>}
        <div className="actions">
          <button className="primary" onClick={go} disabled={busy}>
            {busy ? "Launching…" : "Launch run"}
          </button>
        </div>
      </div>
    </div>
  );
}
