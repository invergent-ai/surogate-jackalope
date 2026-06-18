import { useEffect, useMemo, useState } from "react";
import {
  cloudOptions, launchDstack, launchGrpo, launchModal, launchSft, launchSsh, listGpus,
} from "../lib/ipc";
import { FieldEditor, type FieldDef, type Values } from "../components/FieldEditor";
import { GpuSelect } from "../components/GpuSelect";
import { parseGpus } from "../lib/format";
import type { CloudOpts, GpuInfo } from "../lib/types";

const DEFAULTS: Values = {
  mode: "sft", compute: "local",
  model: "Qwen/Qwen2.5-0.5B", dataset: "tatsu-lab/alpaca", output_dir: "/tmp/jackalope-run",
  precision: "bf16", gpus: "0", epochs: 1, learning_rate: 0.0002,
  ssh_host: "", ssh_key: "", gpu_type: "H100", gpu_count: 1, image: "", backend: "cheapest", region: "",
  trainer_gpus: "0", vllm_gpus: "1", judge_gpus: "2",
};

export function Launch({ onLaunched }: { onLaunched: () => void }) {
  const [v, setV] = useState<Values>(DEFAULTS);
  const [opts, setOpts] = useState<CloudOpts | null>(null);
  const [gpus, setGpus] = useState<GpuInfo[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    cloudOptions().then((o) => { setOpts(o); setV((p) => ({ ...p, image: o.modal_image })); }).catch(() => {});
    listGpus().then(setGpus).catch(() => {});
  }, []);

  const isRL = v.mode === "grpo" || v.mode === "ruler";
  const isSFT = v.mode === "sft";
  const isCloud = v.compute === "modal" || v.compute === "dstack";

  const schema = useMemo<FieldDef[]>(() => {
    const gpuTypes = opts?.modal_gpus ?? ["H100"];
    const backends = ["cheapest", ...(opts?.dstack_backends ?? [])];
    const sft = (vals: Values) => vals.mode === "sft";
    const tgt = (k: string) => (vals: Values) => vals.mode === "sft" && vals.compute === k;
    const cloud = (vals: Values) => vals.mode === "sft" && (vals.compute === "modal" || vals.compute === "dstack");
    const defs: FieldDef[] = [
      { group: "run", key: "mode", label: "mode", kind: "enum", options: ["sft", "grpo", "ruler"],
        desc: { sft: "supervised fine-tuning", grpo: "RL: vLLM rollouts + trainer on split GPUs", ruler: "GRPO + a frozen LLM judge (3-way split)" } },
      { group: "run", key: "compute", label: "compute", kind: "enum", options: ["local", "ssh", "modal", "dstack"], show: sft,
        desc: { local: "your own GPUs", ssh: "a remote box with surogate", modal: "serverless GPU sandbox", dstack: "your cloud backend" } },
      { group: "data", key: "model", label: "model", kind: "text", show: sft, help: "org/model or a local path" },
      { group: "data", key: "dataset", label: "dataset", kind: "text", show: sft, help: "org/dataset or a local path" },
      { group: "data", key: "precision", label: "precision", kind: "enum", options: ["bf16", "fp8", "fp16"], show: sft,
        desc: { bf16: "safe default", fp8: "faster on Hopper/Blackwell", fp16: "older GPUs" } },
      { group: "training", key: "epochs", label: "epochs", kind: "num", show: sft },
      { group: "training", key: "learning_rate", label: "learning rate", kind: "text", show: sft, help: "LoRA SFT likes ~1e-4 to 2e-4" },
      { group: "training", key: "output_dir", label: "output dir", kind: "text", show: sft },
      { group: "ssh", key: "ssh_host", label: "ssh host", kind: "text", show: tgt("ssh"), help: "user@host[:port] or alias" },
      { group: "ssh", key: "ssh_key", label: "identity file", kind: "text", show: tgt("ssh"), help: "optional" },
      { group: "cloud", key: "gpu_type", label: "GPU type", kind: "enum", options: gpuTypes, show: cloud },
      { group: "cloud", key: "gpu_count", label: "GPU count", kind: "num", show: cloud },
      { group: "cloud", key: "image", label: "image", kind: "text", show: cloud, help: "surogate-ready docker image" },
      { group: "cloud", key: "backend", label: "backend", kind: "enum", options: backends, show: tgt("dstack") },
      { group: "cloud", key: "region", label: "region", kind: "text", show: tgt("dstack"), help: "optional" },
    ];
    return defs;
  }, [opts]);

  const setGpuField = (key: string) => (arr: number[]) => setV((p) => ({ ...p, [key]: arr.join(",") }));

  async function launch() {
    setErr(""); setBusy(true);
    try {
      const sft = {
        model: String(v.model), dataset: String(v.dataset), output_dir: String(v.output_dir),
        precision: String(v.precision), gpus: parseGpus(v.gpus), epochs: Number(v.epochs), learning_rate: Number(v.learning_rate),
      };
      if (isRL) {
        if (parseGpus(v.trainer_gpus).length === 0 || parseGpus(v.vllm_gpus).length === 0) throw "Select trainer and vLLM GPUs.";
        await launchGrpo(v.mode === "ruler", parseGpus(v.trainer_gpus), parseGpus(v.vllm_gpus), v.mode === "ruler" ? parseGpus(v.judge_gpus) : []);
      } else if (v.compute === "local") {
        if (sft.gpus.length === 0) throw "Select at least one GPU.";
        await launchSft(sft);
      } else if (v.compute === "ssh") {
        if (!String(v.ssh_host).trim()) throw "Enter an SSH host.";
        await launchSsh(sft, { host: String(v.ssh_host).trim(), port: 0, identity_file: String(v.ssh_key).trim(), workdir: "" });
      } else if (v.compute === "modal") {
        await launchModal(sft, { gpu: String(v.gpu_type), count: Number(v.gpu_count), image: String(v.image) });
      } else {
        await launchDstack(sft, { gpu: String(v.gpu_type), count: Number(v.gpu_count), image: String(v.image), backend: v.backend === "cheapest" ? "" : String(v.backend), region: String(v.region) });
      }
      onLaunched();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  // GPU pickers + hints render between the field grid and the launch button.
  const footer = (
    <>
      {isSFT && v.compute === "local" && (
        <GpuSelect label="GPUs" detected={gpus} value={parseGpus(v.gpus)} onChange={setGpuField("gpus")} />
      )}
      {isRL && (
        <>
          <GpuSelect label="trainer GPUs" detected={gpus} value={parseGpus(v.trainer_gpus)} onChange={setGpuField("trainer_gpus")} />
          <GpuSelect label="vLLM (rollout) GPUs" detected={gpus} value={parseGpus(v.vllm_gpus)} onChange={setGpuField("vllm_gpus")} />
          {v.mode === "ruler" && (
            <GpuSelect label="judge GPUs" detected={gpus} value={parseGpus(v.judge_gpus)} onChange={setGpuField("judge_gpus")} />
          )}
        </>
      )}
      {isSFT && isCloud && <div className="dim hint">GPUs are provisioned in the cloud — set type/count above.</div>}
      {isSFT && v.compute === "ssh" && <div className="dim hint">Uses the remote box's GPUs.</div>}
      {err && <p className="err-text">↳ {err}</p>}
    </>
  );

  return (
    <div>
      <div className="panel-head"><h2>launch</h2></div>
      <div className="card">
        <FieldEditor schema={schema} values={v} onChange={setV} onLaunch={launch} doneLabel="launch run" busy={busy} footer={footer} />
      </div>
    </div>
  );
}
