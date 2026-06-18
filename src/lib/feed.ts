import type { GpuStat, Metric } from "./types";

export interface FeedState {
  cap: number;
  steps: number[];
  loss: number[];
  evalSteps: number[];
  evalLoss: number[];
  gpus: GpuStat[];
  last?: Metric;
}

export function emptyFeed(cap = 5000): FeedState {
  return { cap, steps: [], loss: [], evalSteps: [], evalLoss: [], gpus: [] };
}

export function pushMetric(s: FeedState, m: Metric): FeedState {
  const next: FeedState = {
    ...s,
    steps: s.steps.slice(),
    loss: s.loss.slice(),
    evalSteps: s.evalSteps.slice(),
    evalLoss: s.evalLoss.slice(),
    last: m,
  };
  const x = m.step ?? next.steps.length;
  if (typeof m.loss === "number") {
    next.steps.push(x);
    next.loss.push(m.loss);
  }
  if (typeof m.eval_loss === "number") {
    next.evalSteps.push(x);
    next.evalLoss.push(m.eval_loss);
  }
  if (m.gpus && m.gpus.length) next.gpus = m.gpus;
  while (next.steps.length > next.cap) {
    next.steps.shift();
    next.loss.shift();
  }
  while (next.evalSteps.length > next.cap) {
    next.evalSteps.shift();
    next.evalLoss.shift();
  }
  return next;
}
