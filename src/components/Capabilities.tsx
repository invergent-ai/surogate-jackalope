import { CAPABILITIES } from "../lib/brand";

export function Capabilities() {
  return (
    <div className="caps">
      {CAPABILITIES.map((c) => (
        <div className="cap" key={c.name}>
          <span className={"cap-dot " + c.color} />
          <div>
            <div className="cap-name">{c.name}</div>
            <div className="cap-desc">{c.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
