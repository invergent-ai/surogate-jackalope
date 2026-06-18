import { useEffect, useMemo, useState } from "react";
import { cloudOptions, launchDstack, launchGrpo, launchModal, launchSft, launchSsh } from "../lib/ipc";
import { FieldEditor, type FieldDef, type Values } from "../components/FieldEditor";
import type { CloudOpts } from "../lib/types";

const parseGpus = (s: unknown) =>
  String(s ?? "").split(",").map((x) => Number(x.trim())).filter((n) => !Number.isNaN(n));

const DEFAULTS: Values = {
  mode: "sft",
  compute: "local",
  model: "Qwen/Qwen2.5-0.5B",
  dataset: "tatsu-lab/alpaca",
  output_dir: "/tmp/jackalope-run",
  precision: "bf16",
  gpus: "0",
  epochs: 1,
  learning_rate: 0.0002,
  ssh_host: "",
  ssh_key: "",
  gpu_type: "H100",
  gpu_count: 1,
  image: "",
  backend: "cheapest",
  region: "",
  trainer_gpus: "0",
  vllm_gpus: "1",
  judge_gpus: "2",
};

export function Launch({ onLaunched }: { onLaunched: () => void }) {
  const [v, setV] = useState<Values>(DEFAULTS);
  const [opts, setOpts] = useState<CloudOpts | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    cloudOptions().then((o) => { setOpts(o); setV((p) => ({ ...p, image: o.modal_image })); }).catch(() => {});
  }, []);

  const schema = useMemo<FieldDef[]>(() => {
    const gpuTypes = opts?.modal_gpus ?? ["H100"];
    const backends = ["cheapest", ...(opts?.dstack_backends ?? [])];
    const isRL = (vals: Values) => vals.mode === "grpo" || vals.mode === "ruler";
    const isSFT = (vals: Values) => vals.mode === "sft";
    const tgt = (k: string) => (vals: Values) => isSFT(vals) && vals.compute === k;
    const defs: FieldDef[] = [
      { group: "run", key: "mode", label: "mode", kind: "enum", options: ["sft", "grpo", "ruler"],
        desc: { sft: "supervised fine-tuning", grpo: "RL: vLLM rollouts + trainer on split GPUs", ruler: "GRPO + a frozen LLM judge (3-way split)" } },
      { group: "run", key: "compute", label: "compute", kind: "enum", options: ["local", "ssh", "modal", "dstack"], show: isSFT,
        desc: { local: "your own GPUs", ssh: "a remote box with surogate", modal: "serverless GPU sandbox", dstack: "your cloud backend" } },

      { group: "data", key: "model", label: "model", kind: "text", show: isSFT, help: "org/model or a local path" },
      { group: "data", key: "dataset", label: "dataset", kind: "text", show: isSFT, help: "org/dataset or a local path" },
      { group: "data", key: "precision", label: "precision", kind: "enum", options: ["bf16", "fp8", "fp16"], show: isSFT,
        desc: { bf16: "safe default", fp8: "faster on Hopper/Blackwell", fp16: "older GPUs" } },
      { group: "training", key: "epochs", label: "epochs", kind: "num", show: isSFT },
      { group: "training", key: "learning_rate", label: "learning rate", kind: "text", show: isSFT, help: "LoRA SFT likes ~1e-4 to 2e-4" },
      { group: "training", key: "output_dir", label: "output dir", kind: "text", show: isSFT },

      { group: "local", key: "gpus", label: "GPUs (indices)", kind: "text", show: tgt("local"), help: "comma-separated, e.g. 0,1" },

      { group: "ssh", key: "ssh_host", label: "ssh host", kind: "text", show: tgt("ssh"), help: "user@host[:port] or ~/.ssh/config alias" },
      { group: "ssh", key: "ssh_key", label: "identity file", kind: "text", show: tgt("ssh"), help: "optional, e.g. ~/.ssh/id_ed25519" },

      { group: "cloud", key: "gpu_type", label: "GPU type", kind: "enum", options: gpuTypes, show: (vals) => isSFT(vals) && (vals.compute === "modal" || vals.compute === "dstack") },
      { group: "cloud", key: "gpu_count", label: "GPU count", kind: "num", show: (vals) => isSFT(vals) && (vals.compute === "modal" || vals.compute === "dstack") },
      { group: "cloud", key: "image", label: "image", kind: "text", show: (vals) => isSFT(vals) && (vals.compute === "modal" || vals.compute === "dstack"), help: "surogate-ready docker image" },
      { group: "cloud", key: "backend", label: "backend", kind: "enum", options: backends, show: tgt("dstack") },
      { group: "cloud", key: "region", label: "region", kind: "text", show: tgt("dstack"), help: "optional, e.g. us-east-1" },

      { group: "RL · split GPUs", key: "trainer_gpus", label: "trainer GPUs", kind: "text", show: isRL, help: "comma-separated indices" },
      { group: "RL · split GPUs", key: "vllm_gpus", label: "vLLM (rollout) GPUs", kind: "text", show: isRL },
      { group: "RL · split GPUs", key: "judge_gpus", label: "judge GPUs", kind: "text", show: (vals) => vals.mode === "ruler" },
    ];
    return defs;
  }, [opts]);

  async function launch() {
    setErr("");
    try {
      const sft = {
        model: String(v.model), dataset: String(v.dataset), output_dir: String(v.output_dir),
        precision: String(v.precision), gpus: parseGpus(v.gpus), epochs: Number(v.epochs), learning_rate: Number(v.learning_rate),
      };
      if (v.mode === "grpo" || v.mode === "ruler") {
        await launchGrpo(v.mode === "ruler", parseGpus(v.trainer_gpus), parseGpus(v.vllm_gpus), v.mode === "ruler" ? parseGpus(v.judge_gpus) : []);
      } else if (v.compute === "local") {
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
    }
  }

  return (
    <div>
      <div className="panel-head"><h2>launch</h2></div>
      <div className="card">
        <FieldEditor schema={schema} values={v} onChange={setV} onLaunch={launch} doneLabel="launch run" />
        {err && <p className="err-text">↳ {err}</p>}
      </div>
    </div>
  );
}
