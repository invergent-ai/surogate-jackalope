import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Config, Metric, RunRecord, SftConfig } from "./types";

export const getConfig = () => invoke<Config>("get_config");
export const setConfig = (cfg: Config) => invoke<void>("set_config", { newCfg: cfg });
export const startMonitor = (fromStart = false) => invoke<void>("start_monitor", { fromStart });
export const listRuns = () => invoke<RunRecord[]>("list_runs");
export const runStatus = () => invoke<string>("run_status");
export const stopRun = () => invoke<void>("stop_run");
export const launchSft = (config: SftConfig) => invoke<string>("launch_sft", { config });

export const onMetric = (cb: (m: Metric) => void) =>
  listen<Metric>("metric", (e) => cb(e.payload));
export const onLog = (cb: (line: string) => void) =>
  listen<string>("log", (e) => cb(e.payload));
export const onRunError = (cb: (msg: string) => void) =>
  listen<string>("run-error", (e) => cb(e.payload));
