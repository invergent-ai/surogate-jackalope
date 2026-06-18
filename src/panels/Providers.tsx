import { useEffect, useState } from "react";
import { configureDstack, listProviders } from "../lib/ipc";
import type { Provider } from "../lib/types";

// Credential fields per dstack backend (mirrors dstack.ts DSTACK_BACKEND_FIELDS).
const BACKEND_FIELDS: Record<string, { key: string; label: string; secret?: boolean }[]> = {
  runpod: [{ key: "api_key", label: "API key", secret: true }],
  lambda: [{ key: "api_key", label: "API key", secret: true }],
  vastai: [{ key: "api_key", label: "API key", secret: true }],
  aws: [
    { key: "access_key", label: "Access key id" },
    { key: "secret_key", label: "Secret access key", secret: true },
  ],
};

export function Providers() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [backend, setBackend] = useState("runpod");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function refresh() {
    listProviders().then(setProviders).catch(() => setProviders([]));
  }
  useEffect(refresh, []);

  async function save() {
    setMsg(null);
    try {
      await configureDstack(backend, fields);
      setMsg({ ok: true, text: `${backend} configured in ~/.dstack/server/config.yml` });
      setFields({});
    } catch (e) {
      setMsg({ ok: false, text: String(e) });
    }
  }

  return (
    <div>
      <div className="panel-head">
        <h2>Providers</h2>
        <button className="ghost" onClick={refresh}>Refresh</button>
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

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Configure a dstack backend</div>
        <label>Backend</label>
        <select value={backend} onChange={(e) => { setBackend(e.target.value); setFields({}); }}>
          {Object.keys(BACKEND_FIELDS).map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        {BACKEND_FIELDS[backend].map((f) => (
          <div key={f.key}>
            <label>{f.label}</label>
            <input
              type={f.secret ? "password" : "text"}
              value={fields[f.key] ?? ""}
              onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
            />
          </div>
        ))}
        {msg && <p className={msg.ok ? "" : "err-text"} style={msg.ok ? { color: "var(--ok-fg)" } : {}}>{msg.text}</p>}
        <div className="actions">
          <button className="primary" onClick={save}>Save backend credentials</button>
        </div>
      </div>
    </div>
  );
}
