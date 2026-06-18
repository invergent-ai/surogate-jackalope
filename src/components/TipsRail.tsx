import { useRotatingTips } from "../lib/useRotatingTips";

export function TipsRail() {
  const { tips, tip, index, setIndex } = useRotatingTips(6000);
  if (!tip) return <aside className="rail" />;

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
          <span key={k} className={"dot" + (k === index ? " on" : "")} onClick={() => setIndex(k)} />
        ))}
      </div>
    </aside>
  );
}
