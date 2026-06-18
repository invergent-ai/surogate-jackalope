import { useEffect, useRef } from "react";
import { useLogStream } from "../lib/useLogStream";

export function Logs() {
  const { lines, clear } = useLogStream(1000);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  return (
    <div>
      <div className="panel-head">
        <h2>Logs</h2>
        <button className="ghost" onClick={clear}>
          Clear
        </button>
      </div>
      <div className="logs logs-full" ref={ref}>
        {lines.length ? lines.join("\n") : "Waiting for run output…"}
      </div>
    </div>
  );
}
