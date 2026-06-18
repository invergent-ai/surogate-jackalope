import { useEffect, useState } from "react";
import { listTips } from "../lib/ipc";
import type { Tip } from "../lib/types";

export function TipsRail() {
  const [tips, setTips] = useState<Tip[]>([]);
  const [i, setI] = useState(0);

  useEffect(() => {
    listTips().then(setTips).catch(() => setTips([]));
  }, []);

  useEffect(() => {
    if (tips.length < 2) return;
    const t = setInterval(() => setI((p) => (p + 1) % tips.length), 6000);
    return () => clearInterval(t);
  }, [tips]);

  if (!tips.length) return <aside className="rail" />;
  const tip = tips[i];

  return (
    <aside className="rail">
      <div className="rail-head">✦ Live tips</div>
      <div className="rail-card">
        <div className="rail-topic">{tip.topic}</div>
        <div className="rail-title">{tip.title}</div>
        <div className="rail-body">{tip.body}</div>
      </div>
      <div className="rail-dots">
        {tips.map((_, k) => (
          <span key={k} className={"dot" + (k === i ? " on" : "")} onClick={() => setI(k)} />
        ))}
      </div>
    </aside>
  );
}
