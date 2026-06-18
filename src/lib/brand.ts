// Surogate brand constants, mirrored from jackalope (src/ui/brand.ts +
// StartScreen capability showcase) so the desktop app stays in parity.

export const TAGLINE = "FP8 / FP4 · Training · Fine-tuning · RL";

export type DotColor = "accent" | "green" | "eval" | "warm" | "gold";

// PostHog "colored dot + name + one-line problem" pattern — a compact, real
// capability showcase grounded in surogate's docs.
export const CAPABILITIES: { name: string; desc: string; color: DotColor }[] = [
  { name: "Precision recipes", desc: "bf16 · fp8-hybrid · NVFP4 4-bit", color: "accent" },
  { name: "LoRA / QLoRA", desc: "adapters on tiny VRAM (NF4/fp8/fp4)", color: "green" },
  { name: "RL fine-tuning", desc: "GRPO · RULER with an LLM judge", color: "eval" },
  { name: "Mixture-of-Experts", desc: "expert-parallel · router LoRA", color: "warm" },
  { name: "Scale & offload", desc: "multi-GPU ZeRO 1/2/3 · CPU offload", color: "gold" },
];

// Compute targets, mirrored from setup.ts. `install` is the local client command.
export const COMPUTE_TARGETS: {
  id: "local" | "ssh" | "modal" | "dstack";
  label: string;
  blurb: string;
  install?: string;
  postHint?: string;
}[] = [
  { id: "local", label: "Local GPUs", blurb: "Train on the NVIDIA GPUs in this machine." },
  { id: "ssh", label: "SSH", blurb: "A remote box with surogate installed.", postHint: "ssh user@host" },
  {
    id: "modal",
    label: "Modal",
    blurb: "Serverless GPU sandbox — surogate runs in Modal's container.",
    install: "uv tool install modal",
    postHint: "modal token new",
  },
  {
    id: "dstack",
    label: "dstack",
    blurb: "Your cloud backend (RunPod / Lambda / AWS / GCP…).",
    install: 'uv tool install "dstack[all]"',
    postHint: "dstack server",
  },
];
