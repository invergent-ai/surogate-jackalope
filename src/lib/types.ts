export interface GpuStat {
  index: number;
  util: number;
  mem_used: number;
  mem_total: number;
  temp: number;
  power: number;
}

export interface Metric {
  step?: number;
  epoch?: number;
  total_steps?: number;
  loss?: number;
  eval_loss?: number;
  lr?: number;
  grad_norm?: number;
  throughput?: number;
  phase?: string;
  gpus: GpuStat[];
}

export interface Config {
  surogate_bin: string;
  feed_path: string;
  repo_root: string;
  runs_dir: string;
  onboarded: boolean;
  compute: string;
}

export type Compute = "local" | "ssh" | "modal" | "dstack";

export interface ModalConfig {
  gpu: string;
  count: number;
  image: string;
}

export interface DstackConfig {
  gpu: string;
  count: number;
  image: string;
  backend: string;
  region: string;
}

export interface CloudOpts {
  modal_image: string;
  modal_gpus: string[];
  dstack_backends: string[];
}

export interface SshTarget {
  host: string;
  port: number;
  identity_file: string;
  workdir: string;
}

export type LaunchMode = "sft" | "grpo" | "ruler";

export interface RunRecord {
  id: string;
  model: string;
  mode: string;
  status: string;
  started_ms: number;
  output_dir: string;
  remote_kind?: string;
  remote_host?: string;
  remote_dir?: string;
  remote_session?: string;
  remote_port?: number;
  remote_identity?: string;
}

export interface SftConfig {
  model: string;
  dataset: string;
  output_dir: string;
  precision: string;
  gpus: number[];
  epochs: number;
  learning_rate: number;
}

export interface GpuInfo {
  index: number;
  name: string;
  util: number;
  mem_used: number;
  mem_total: number;
  temp: number;
  power: number;
}

export interface Tip {
  title: string;
  body: string;
  topic: string;
}

export interface Provider {
  id: string;
  label: string;
  available: boolean;
  detail: string;
}

export interface HfItem {
  id: string;
  downloads: number;
  likes: number;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
}
