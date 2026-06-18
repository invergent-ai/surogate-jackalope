import { useEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

export function LossChart({ steps, loss }: { steps: number[]; loss: number[] }) {
  const el = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const opts: uPlot.Options = {
      width: el.current.clientWidth || 700,
      height: 280,
      series: [{}, { label: "loss", stroke: "#d8b25a", width: 2 }],
      axes: [
        { stroke: "#8b93a1", grid: { stroke: "#1c2027" } },
        { stroke: "#8b93a1", grid: { stroke: "#1c2027" } },
      ],
      scales: { x: { time: false } },
    };
    plot.current = new uPlot(opts, [steps, loss], el.current);
    const onResize = () => {
      if (el.current && plot.current) plot.current.setSize({ width: el.current.clientWidth, height: 280 });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      plot.current?.destroy();
      plot.current = null;
    };
  }, []);

  useEffect(() => {
    plot.current?.setData([steps, loss]);
  }, [steps, loss]);

  return <div ref={el} />;
}
