import { useEffect, useRef, useState } from "react";
import { emptyFeed, pushMetric, type FeedState } from "../lib/feed";
import { onMetric, stopRun } from "../lib/ipc";
import { useLogStream } from "../lib/useLogStream";
import { LossChart } from "../components/LossChart";
import { GpuMeter } from "../components/GpuMeter";
import { LogStream } from "../components/LogStream";
import { StatusBadge } from "../components/StatusBadge";

export function Monitor({ status }: { status: string }) {
  const [feed, setFeed] = useState<FeedState>(emptyFeed());
  const { lines: logs } = useLogStream(400);
  const feedRef = useRef(feed);
  feedRef.current = feed;

  useEffect(() => {
    const unMetric = onMetric((m) => setFeed(pushMetric(feedRef.current, m)));
    return () => {
      unMetric.then((f) => f());
    };
  }, []);

  const last = feed.last;
  const pct =
    last?.step && last?.total_steps ? Math.round((last.step / last.total_steps) * 100) : 0;

  return (
    <div>
      <div className="panel-head">
        <h2>Monitor</h2>
        <div className="panel-head-right">
          <StatusBadge status={status} />
          {status === "running" && (
            <button className="danger" onClick={() => stopRun()}>
              Stop
            </button>
          )}
        </div>
      </div>

      <div className="card">
        {feed.loss.length ? (
          <LossChart steps={feed.steps} loss={feed.loss} />
        ) : (
          <p className="dim">Waiting for a run… start one from the Launch tab.</p>
        )}
        {last && (
          <div className="dim metaline">
            step {last.step ?? "–"}
            {last.total_steps ? `/${last.total_steps} (${pct}%)` : ""} · lr {fmt(last.lr)} · grad{" "}
            {fmt(last.grad_norm)} · {fmt(last.throughput)} tok/s
            {last.phase ? ` · ${last.phase}` : ""}
          </div>
        )}
      </div>

      {feed.gpus.length > 0 && (
        <div className="card meters">
          {feed.gpus.map((g) => (
            <GpuMeter key={g.index} g={g} />
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">Logs</div>
        <LogStream lines={logs} />
      </div>
    </div>
  );
}

function fmt(n?: number): string {
  if (typeof n !== "number") return "–";
  return Math.abs(n) < 0.001 && n !== 0 ? n.toExponential(2) : String(Math.round(n * 1000) / 1000);
}
