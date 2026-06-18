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
}

export interface RunRecord {
  id: string;
  model: string;
  mode: string;
  status: string;
  started_ms: number;
  output_dir: string;
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
