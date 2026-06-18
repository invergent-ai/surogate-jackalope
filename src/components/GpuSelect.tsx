import { gb, parseGpus } from "../lib/format";
import type { GpuInfo } from "../lib/types";

// Click GPUs to toggle them into the selection (jackalope's space-to-select GPU
// picker, mouse-driven). Falls back to a manual indices input when no NVIDIA GPUs
// are detected (e.g. remote/cloud targets or a GPU-less laptop).
export function GpuSelect({
  label,
  detected,
  value,
  onChange,
}: {
  label: string;
  detected: GpuInfo[];
  value: number[];
  onChange: (v: number[]) => void;
}) {
  const toggle = (i: number) =>
    onChange(value.includes(i) ? value.filter((x) => x !== i) : [...value, i].sort((a, b) => a - b));

  return (
    <div className="gpusel">
      <div className="gpusel-label">{label}</div>
      {detected.length === 0 ? (
        <div className="gpusel-manual">
          <span className="dim">no GPUs detected here — indices:</span>
          <input
            value={value.join(",")}
            onChange={(e) => onChange(parseGpus(e.target.value))}
            placeholder="0,1"
          />
        </div>
      ) : (
        detected.map((g) => {
          const on = value.includes(g.index);
          return (
            <button key={g.index} className={"gpusel-row" + (on ? " on" : "")} onClick={() => toggle(g.index)}>
              <span className="box">{on ? "[✓]" : "[ ]"}</span>
              <span className="gpusel-name">
                gpu{g.index} · {g.name} · {gb(g.mem_total)} GB
              </span>
              <span className="gpusel-util dim">{g.util}%</span>
            </button>
          );
        })
      )}
    </div>
  );
}
