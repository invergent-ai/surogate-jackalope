import { describe, it, expect } from "vitest";
import { pushMetric, emptyFeed } from "./feed";
import type { Metric } from "./types";

const m = (step: number, loss: number): Metric => ({ step, loss, gpus: [] });

describe("feed reducer", () => {
  it("appends loss points with step as x", () => {
    let s = emptyFeed(10);
    s = pushMetric(s, m(1, 2.0));
    s = pushMetric(s, m(2, 1.5));
    expect(s.steps).toEqual([1, 2]);
    expect(s.loss).toEqual([2.0, 1.5]);
  });

  it("caps the ring buffer at capacity", () => {
    let s = emptyFeed(2);
    s = pushMetric(s, m(1, 3));
    s = pushMetric(s, m(2, 2));
    s = pushMetric(s, m(3, 1));
    expect(s.steps).toEqual([2, 3]);
    expect(s.loss).toEqual([2, 1]);
  });

  it("keeps the latest gpu snapshot", () => {
    let s = emptyFeed(5);
    s = pushMetric(s, {
      step: 1,
      loss: 1,
      gpus: [{ index: 0, util: 90, mem_used: 1, mem_total: 2, temp: 60, power: 100 }],
    });
    expect(s.gpus[0].util).toBe(90);
  });

  it("records eval loss markers separately", () => {
    let s = emptyFeed(5);
    s = pushMetric(s, { step: 5, eval_loss: 1.1, gpus: [] });
    expect(s.evalSteps).toEqual([5]);
    expect(s.evalLoss).toEqual([1.1]);
  });
});
