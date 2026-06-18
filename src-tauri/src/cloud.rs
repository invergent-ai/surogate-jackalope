// Cloud compute: run surogate on Modal (a GPU Sandbox via the modal SDK) or
// dstack (any cloud backend via `dstack apply`). Both stream metric JSONL + log
// lines over the child process's stdout; we append metric lines to the local feed
// file (so the existing Monitor tail works unchanged) and emit the rest as logs.
//
// Ported from jackalope's modal.ts / dstack.ts.

use serde::{Deserialize, Serialize};

pub const MODAL_DEFAULT_IMAGE: &str = "ghcr.io/invergent-ai/surogate:latest-cu128";
pub const MODAL_GPUS: &[&str] = &[
    "T4", "L4", "A10", "L40S", "A100-40GB", "A100-80GB", "H100", "H200", "B200",
];
pub const DSTACK_BACKENDS: &[&str] = &["runpod", "lambda", "vastai", "aws"];

#[derive(Clone, Debug, Deserialize)]
pub struct ModalConfig {
    pub gpu: String,
    pub count: u32,
    pub image: String,
}

#[derive(Clone, Debug, Deserialize)]
pub struct DstackConfig {
    pub gpu: String,
    pub count: u32,
    pub image: String,
    #[serde(default)]
    pub backend: String,
    #[serde(default)]
    pub region: String,
}

/// surogate must write its outputs onto the mounted Volume so they can be
/// retrieved later — pin output_dir to /outputs/model (YAML last-key-wins).
pub fn config_on_volume(config_text: &str) -> String {
    format!("{}\noutput_dir: /outputs/model\n", config_text.trim_end())
}

/// The Modal Python driver, run with `uv run --with modal python driver.py`.
/// Reads everything from env; creates a Sandbox, runs surogate, tails metrics to
/// stdout, and terminates the sandbox on stop/exit. Persists sandbox.id so a stop
/// from a fresh process can still terminate a paid GPU.
pub const MODAL_DRIVER: &str = r#"
import base64, os, signal, sys
import modal

gpu_t = os.environ.get("JK_GPU", "H100")
count = os.environ.get("JK_COUNT", "1")
mode = os.environ.get("JK_MODE", "sft")
image_uri = os.environ.get("JK_IMAGE", "ghcr.io/invergent-ai/surogate:latest-cu128")
volume = os.environ.get("JK_VOLUME", "jackalope-run")
config = base64.b64decode(os.environ["JK_CONFIG_B64"]).decode()
gpu = gpu_t if count in ("", "1") else gpu_t + ":" + count

app = modal.App.lookup("jackalope", create_if_missing=True)
vol = modal.Volume.from_name(volume, create_if_missing=True)
image = modal.Image.from_registry(
    image_uri, add_python="3.12",
    setup_dockerfile_commands=["ENV PATH=/usr/local/bin:$PATH"],
).entrypoint([])

print("JK: creating " + gpu + " sandbox (image " + image_uri + ")", file=sys.stderr, flush=True)
sb = modal.Sandbox.create(app=app, image=image, gpu=gpu, timeout=24 * 3600,
                          volumes={"/outputs": vol}, workdir="/root")
sid = sb.object_id or ""
try:
    open("sandbox.id", "w").write(sid)
except Exception:
    pass
print("JK: sandbox " + (sid or "?"), file=sys.stderr, flush=True)

def _cleanup(*_):
    try:
        sb.terminate()
    finally:
        os._exit(1)
signal.signal(signal.SIGTERM, _cleanup)
signal.signal(signal.SIGINT, _cleanup)

try:
    cfg_b64 = base64.b64encode(config.encode()).decode()
    sb.exec("bash", "-lc", "mkdir -p /root /outputs && echo " + cfg_b64 + " | base64 -d > /root/config.yaml").wait()
    run = ("cd /root && touch /outputs/metrics.jsonl /outputs/train.log && "
           "(SUROGATE_METRICS_PATH=/outputs/metrics.jsonl surogate " + mode + " config.yaml > /outputs/train.log 2>&1; "
           "echo $? > /outputs/DONE) & "
           "tail -n +1 -F /outputs/metrics.jsonl & TM=$! ; "
           "tail -n +1 -F /outputs/train.log & TL=$! ; "
           "while [ ! -f /outputs/DONE ]; do sleep 2; done; sleep 2; "
           "kill $TM $TL 2>/dev/null; echo JK_EXIT $(cat /outputs/DONE)")
    p = sb.exec("bash", "-lc", run)
    for line in p.stdout:
        sys.stdout.write(line)
        sys.stdout.flush()
    p.wait()
finally:
    sb.terminate()
print("JK_DONE", flush=True)
"#;

/// Generate a dstack task config. The surogate config is embedded via a heredoc
/// so nothing has to be uploaded; metrics stream out on stdout. Pure → testable.
pub fn dstack_task_yaml(
    name: &str,
    cfg: &DstackConfig,
    config_text: &str,
    surogate_bin: &str,
) -> String {
    let indented = config_text.trim_end().replace('\n', "\n    ");
    let mut lines = vec![
        "type: task".to_string(),
        format!("name: {name}"),
        format!("image: {}", cfg.image),
    ];
    if !cfg.backend.is_empty() {
        lines.push(format!("backends: [{}]", cfg.backend));
    }
    if !cfg.region.is_empty() {
        lines.push(format!("regions: [{}]", cfg.region));
    }
    lines.push("commands:".into());
    lines.push("  - |".into());
    lines.push("    cat > config.yaml <<'JACKALOPE_YAML'".into());
    lines.push(format!("    {indented}"));
    lines.push("    JACKALOPE_YAML".into());
    lines.push(format!(
        "    SUROGATE_METRICS_PATH=metrics.jsonl {surogate_bin} sft config.yaml > train.log 2>&1 &"
    ));
    lines.push("    sleep 3".into());
    lines.push("    tail -n +1 -F metrics.jsonl".into());
    lines.push("resources:".into());
    lines.push(format!("  gpu: \"{}:{}\"", cfg.gpu, cfg.count));
    lines.join("\n") + "\n"
}

/// A dstack backend entry (type + creds) as a YAML value, for the common
/// api_key backends and AWS. Ported from dstack.ts credsBackend.
pub fn backend_entry(backend: &str, fields: &serde_json::Map<String, serde_json::Value>) -> Result<serde_yaml::Value, String> {
    let v = |k: &str| -> String {
        fields.get(k).and_then(|x| x.as_str()).unwrap_or("").trim().to_string()
    };
    let require = |k: &str, label: &str| -> Result<String, String> {
        let val = v(k);
        if val.is_empty() { Err(format!("missing {label}")) } else { Ok(val) }
    };
    use serde_yaml::Value as Y;
    let mut map = serde_yaml::Mapping::new();
    match backend {
        "runpod" | "lambda" | "vastai" => {
            let key = require("api_key", "API key")?;
            map.insert(Y::from("type"), Y::from(backend));
            let mut creds = serde_yaml::Mapping::new();
            creds.insert(Y::from("type"), Y::from("api_key"));
            creds.insert(Y::from("api_key"), Y::from(key));
            map.insert(Y::from("creds"), Y::Mapping(creds));
        }
        "aws" => {
            let ak = require("access_key", "access key id")?;
            let sk = require("secret_key", "secret access key")?;
            map.insert(Y::from("type"), Y::from("aws"));
            let mut creds = serde_yaml::Mapping::new();
            creds.insert(Y::from("type"), Y::from("access_key"));
            creds.insert(Y::from("access_key"), Y::from(ak));
            creds.insert(Y::from("secret_key"), Y::from(sk));
            map.insert(Y::from("creds"), Y::Mapping(creds));
        }
        other => return Err(format!("unsupported backend {other}")),
    }
    Ok(serde_yaml::Value::Mapping(map))
}

/// Merge a backend into the `main` project of a dstack server config doc,
/// replacing a same-type backend (idempotent re-config), preserving everything
/// else. Ported from dstack.ts mergeDstackBackend.
pub fn merge_dstack_backend(
    existing: Option<serde_yaml::Value>,
    backend: &str,
    fields: &serde_json::Map<String, serde_json::Value>,
) -> Result<serde_yaml::Value, String> {
    use serde_yaml::Value as Y;
    let entry = backend_entry(backend, fields)?;
    let entry_type = entry.get("type").cloned();

    let mut doc = match existing {
        Some(v @ Y::Mapping(_)) => v,
        None | Some(Y::Null) => Y::Mapping(serde_yaml::Mapping::new()),
        Some(_) => return Err("existing dstack config is not a mapping".into()),
    };
    let root = doc.as_mapping_mut().unwrap();

    let projects = root.entry(Y::from("projects")).or_insert(Y::Sequence(vec![]));
    let projects = projects
        .as_sequence_mut()
        .ok_or("existing dstack config has a non-list `projects`")?;

    // find or create the `main` project
    let main_idx = projects.iter().position(|p| p.get("name").and_then(|n| n.as_str()) == Some("main"));
    let main = match main_idx {
        Some(i) => &mut projects[i],
        None => {
            let mut m = serde_yaml::Mapping::new();
            m.insert(Y::from("name"), Y::from("main"));
            m.insert(Y::from("backends"), Y::Sequence(vec![]));
            projects.push(Y::Mapping(m));
            projects.last_mut().unwrap()
        }
    };
    let main_map = main.as_mapping_mut().unwrap();
    let backends = main_map.entry(Y::from("backends")).or_insert(Y::Sequence(vec![]));
    let backends = backends
        .as_sequence_mut()
        .ok_or("existing dstack `main` project has non-list `backends`")?;

    match backends.iter().position(|b| b.get("type") == entry_type.as_ref()) {
        Some(i) => backends[i] = entry,
        None => backends.push(entry),
    }
    Ok(doc)
}

#[derive(Serialize)]
pub struct CloudOpts {
    pub modal_image: String,
    pub modal_gpus: Vec<String>,
    pub dstack_backends: Vec<String>,
}

pub fn cloud_opts() -> CloudOpts {
    CloudOpts {
        modal_image: MODAL_DEFAULT_IMAGE.into(),
        modal_gpus: MODAL_GPUS.iter().map(|s| s.to_string()).collect(),
        dstack_backends: DSTACK_BACKENDS.iter().map(|s| s.to_string()).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dcfg() -> DstackConfig {
        DstackConfig {
            gpu: "H100".into(),
            count: 1,
            image: "ghcr.io/invergent-ai/surogate:latest-cu128".into(),
            backend: "runpod".into(),
            region: String::new(),
        }
    }

    #[test]
    fn task_yaml_embeds_config_and_streams() {
        let y = dstack_task_yaml("sur-run1", &dcfg(), "model_name_or_path: x\nlearning_rate: 0.0002", "surogate");
        assert!(y.contains("type: task"));
        assert!(y.contains("name: sur-run1"));
        assert!(y.contains("backends: [runpod]"));
        assert!(y.contains("JACKALOPE_YAML"));
        assert!(y.contains("tail -n +1 -F metrics.jsonl"));
        assert!(y.contains("gpu: \"H100:1\""));
        // config lines are indented under the heredoc
        assert!(y.contains("    model_name_or_path: x"));
    }

    #[test]
    fn config_on_volume_pins_output_dir() {
        let c = config_on_volume("model_name_or_path: x\n");
        assert!(c.contains("output_dir: /outputs/model"));
    }

    #[test]
    fn merge_creates_main_project_with_backend() {
        let mut fields = serde_json::Map::new();
        fields.insert("api_key".into(), serde_json::Value::from("sk-123"));
        let doc = merge_dstack_backend(None, "runpod", &fields).unwrap();
        let s = serde_yaml::to_string(&doc).unwrap();
        assert!(s.contains("name: main"));
        assert!(s.contains("type: runpod"));
        assert!(s.contains("api_key: sk-123"));
    }

    #[test]
    fn merge_replaces_same_type_backend() {
        let mut fields = serde_json::Map::new();
        fields.insert("api_key".into(), serde_json::Value::from("old"));
        let doc = merge_dstack_backend(None, "runpod", &fields).unwrap();
        fields.insert("api_key".into(), serde_json::Value::from("new"));
        let doc2 = merge_dstack_backend(Some(doc), "runpod", &fields).unwrap();
        let s = serde_yaml::to_string(&doc2).unwrap();
        assert!(s.contains("api_key: new"));
        assert!(!s.contains("api_key: old"));
        // still exactly one runpod backend
        assert_eq!(s.matches("type: runpod").count(), 1);
    }

    #[test]
    fn merge_rejects_missing_api_key() {
        let fields = serde_json::Map::new();
        assert!(merge_dstack_backend(None, "runpod", &fields).is_err());
    }
}
