import { useEffect, useRef } from "react";

export function LogStream({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);
  return (
    <div className="logs" ref={ref}>
      {lines.length ? lines.join("\n") : "No log output yet."}
    </div>
  );
}
