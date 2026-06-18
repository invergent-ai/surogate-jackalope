// Curated showcase copy — mirrored from the marketing site's hero scenes so the
// app and website stay in parity. Pure decoration; no live data.

export const MODELS: { name: string; meta: string }[] = [
  { name: "Qwen3 · Qwen3-MoE · Qwen3-VL", meta: "0.6B–235B" },
  { name: "Llama 3.1 / 3.2", meta: "1B–405B" },
  { name: "GPT-OSS", meta: "20B · 120B" },
  { name: "Nemotron Nano / Super", meta: "MoE" },
  { name: "Qwen3.5 · Qwen3.5-MoE", meta: "0.8B–397B" },
  { name: "dense + MoE · vision · more", meta: "PRs welcome" },
];

export const GPU_GENS: { name: string; sub: string }[] = [
  { name: "B200 / B300", sub: "Blackwell" },
  { name: "H100 / H200", sub: "Hopper" },
  { name: "RTX 5090 / 5080", sub: "Blackwell" },
  { name: "A100 / A10", sub: "Ampere" },
  { name: "L40S / L4", sub: "Ada" },
  { name: "RTX 40xx", sub: "Ada" },
];

// `x` = relative throughput multiplier; `color` is a theme CSS var.
export const RECIPES: { name: string; sub: string; x: number; color: string }[] = [
  { name: "bf16", sub: "max accuracy", x: 1.0, color: "var(--eval)" },
  { name: "fp8-hybrid", sub: "E4M3 / E5M2", x: 1.9, color: "var(--green)" },
  { name: "NVFP4", sub: "4-bit · Blackwell", x: 2.6, color: "var(--gold)" },
];
// Largest multiplier — derived so adding a recipe can't desync a hardcoded max.
export const RECIPE_MAX = Math.max(...RECIPES.map((r) => r.x));
