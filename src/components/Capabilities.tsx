import { CAPABILITIES } from "../lib/brand";

export function Capabilities() {
  return (
    <div className="caps">
      {CAPABILITIES.map((c) => (
        <div className="cap" key={c.name}>
          <span className={"cap-dot " + c.color}>●</span>
          <span className="cap-name">{c.name}</span>
          <span className="cap-desc">— {c.desc}</span>
        </div>
      ))}
    </div>
  );
}
