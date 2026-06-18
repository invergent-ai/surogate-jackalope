import { useEffect, useState } from "react";
import { Brand } from "../components/Brand";
import { COMPUTE_TARGETS } from "../lib/brand";
import { completeOnboarding, listProviders, surogateVersion } from "../lib/ipc";
import type { Compute, Provider } from "../lib/types";

const STEPS = ["Compute", "Get surogate", "Ready"];

export function Setup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [compute, setCompute] = useState<Compute>("local");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [version, setVersion] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    listProviders().then(setProviders).catch(() => {});
  }, []);

  function recheck() {
    setChecking(true);
    surogateVersion()
      .then(setVersion)
      .finally(() => setChecking(false));
  }
  useEffect(() => {
    if (step === 1) recheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function finish() {
    await completeOnboarding(compute).catch(() => {});
    onDone();
  }

  const target = COMPUTE_TARGETS.find((t) => t.id === compute)!;
  const provReady = providers.find((p) => p.id === compute)?.available ?? false;

  return (
    <div className="setup">
      <div className="setup-card">
        <div className="setup-brand">
          <Brand size={34} />
          <div>
            <div className="brand-name">Welcome to Jackalope</div>
            <div className="brand-sub">by Surogate · first-run setup</div>
          </div>
        </div>

        <div className="stepper">
          {STEPS.map((s, i) => (
            <div key={s} className={"step" + (i === step ? " on" : i < step ? " done" : "")}>
              <span className="step-num">{i < step ? "✓" : i + 1}</span>
              {s}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="step-body">
            <p className="dim">Where should training run?</p>
            <div className="compute-grid">
              {COMPUTE_TARGETS.map((t) => {
                const avail = providers.find((p) => p.id === t.id)?.available;
                return (
                  <button
                    key={t.id}
                    className={"compute-card" + (compute === t.id ? " sel" : "")}
                    onClick={() => setCompute(t.id)}
                  >
                    <div className="compute-head">
                      <strong>{t.label}</strong>
                      {avail !== undefined && (
                        <span className={"badge " + (avail ? "ok" : "idle")}>
                          {avail ? "ready" : "set up"}
                        </span>
                      )}
                    </div>
                    <div className="dim compute-blurb">{t.blurb}</div>
                  </button>
                );
              })}
            </div>
            <div className="setup-actions">
              <button className="primary" onClick={() => setStep(1)}>
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="step-body">
            <p className="dim">Getting surogate for: {target.label}</p>
            {version ? (
              <div className="card ok-line">
                <span className="badge ok">found</span> {version}
              </div>
            ) : (
              <div className="card">
                <div className="dim" style={{ marginBottom: 8 }}>
                  {checking ? "Checking…" : "surogate not detected on PATH."}
                </div>
                {target.install && (
                  <div>
                    <div className="dim" style={{ marginBottom: 4 }}>Install the {target.label} client:</div>
                    <code className="cmd">{target.install}</code>
                  </div>
                )}
                {!target.install && (
                  <code className="cmd">curl -fsSL https://surogate.ai/install.sh | sh</code>
                )}
                {target.postHint && (
                  <div className="dim" style={{ marginTop: 8 }}>
                    then: <code className="cmd inline">{target.postHint}</code>
                  </div>
                )}
                {compute !== "local" && (
                  <div className="dim" style={{ marginTop: 8 }}>
                    {target.label}: {provReady ? "client detected ✓" : "client not detected yet"}
                  </div>
                )}
              </div>
            )}
            <div className="setup-actions">
              <button className="ghost" onClick={() => setStep(0)}>
                Back
              </button>
              <button className="ghost" onClick={recheck} disabled={checking}>
                Re-check
              </button>
              <button className="primary" onClick={() => setStep(2)}>
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="step-body">
            <div className="ready-mark">✦</div>
            <h3>You're set up</h3>
            <p className="dim">
              Compute: <strong>{target.label}</strong>
              {version ? ` · ${version}` : " · surogate will be resolved at launch"}
            </p>
            <div className="setup-actions">
              <button className="ghost" onClick={() => setStep(0)}>
                Back
              </button>
              <button className="primary" onClick={finish}>
                Open Jackalope
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
