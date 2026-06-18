import { useEffect, useState } from "react";
import { listProviders } from "../lib/ipc";
import type { Provider } from "../lib/types";

export function Providers() {
  const [providers, setProviders] = useState<Provider[]>([]);
  useEffect(() => {
    listProviders().then(setProviders).catch(() => setProviders([]));
  }, []);

  return (
    <div>
      <div className="panel-head">
        <h2>Providers</h2>
        <span className="dim">compute targets</span>
      </div>
      <div className="card dim" style={{ marginBottom: 16 }}>
        Credentials are never stored by Jackalope — they live in each tool's native
        store (Modal → ~/.modal.toml, dstack → ~/.dstack, SSH → ~/.ssh).
      </div>
      <div className="prov-grid">
        {providers.map((p) => (
          <div className="card prov-card" key={p.id}>
            <div className="prov-head">
              <strong>{p.label}</strong>
              <span className={"badge " + (p.available ? "ok" : "idle")}>
                {p.available ? "ready" : "not set up"}
              </span>
            </div>
            <div className="dim prov-detail">{p.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
