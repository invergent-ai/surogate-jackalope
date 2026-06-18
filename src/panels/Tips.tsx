import { useEffect, useState } from "react";
import { listTips } from "../lib/ipc";
import type { Tip } from "../lib/types";

export function Tips() {
  const [tips, setTips] = useState<Tip[]>([]);
  useEffect(() => {
    listTips().then(setTips).catch(() => setTips([]));
  }, []);

  return (
    <div>
      <div className="panel-head">
        <h2>Tips</h2>
      </div>
      <div className="tip-grid">
        {tips.map((t, i) => (
          <div className="card tip-card" key={i}>
            <div className="rail-topic">{t.topic}</div>
            <div className="rail-title">{t.title}</div>
            <div className="rail-body">{t.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
