use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct RunRecord {
    pub id: String,
    pub model: String,
    pub mode: String,
    pub status: String,
    pub started_ms: u128,
    pub output_dir: String,
    /// Where the run executed: "" (local) | "ssh" | "modal" | "dstack".
    #[serde(default)]
    pub remote_kind: String,
    #[serde(default)]
    pub remote_host: String,
    #[serde(default)]
    pub remote_dir: String,
    #[serde(default)]
    pub remote_session: String,
    #[serde(default)]
    pub remote_port: u32,
    #[serde(default)]
    pub remote_identity: String,
}

pub fn list_runs(dir: &Path) -> Vec<RunRecord> {
    let mut out: Vec<RunRecord> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for e in entries.flatten() {
            if e.path().extension().and_then(|x| x.to_str()) == Some("json") {
                if let Ok(s) = std::fs::read_to_string(e.path()) {
                    if let Ok(r) = serde_json::from_str::<RunRecord>(&s) {
                        out.push(r);
                    }
                }
            }
        }
    }
    out.sort_by(|a, b| b.started_ms.cmp(&a.started_ms));
    out
}

pub fn write_record(dir: &Path, r: &RunRecord) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let s = serde_json::to_string_pretty(r).map_err(|e| e.to_string())?;
    std::fs::write(dir.join(format!("{}.json", r.id)), s).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn lists_run_records_sorted_newest_first() {
        let dir = tempdir().unwrap();
        std::fs::write(
            dir.path().join("run-1.json"),
            r#"{"id":"run-1","model":"m","mode":"sft","status":"done","started_ms":100,"output_dir":"/a"}"#,
        )
        .unwrap();
        std::fs::write(
            dir.path().join("run-2.json"),
            r#"{"id":"run-2","model":"m","mode":"sft","status":"done","started_ms":200,"output_dir":"/b"}"#,
        )
        .unwrap();
        let runs = list_runs(dir.path());
        assert_eq!(runs.len(), 2);
        assert_eq!(runs[0].id, "run-2"); // newest first
    }

    #[test]
    fn missing_dir_returns_empty() {
        let dir = tempdir().unwrap();
        assert!(list_runs(&dir.path().join("nope")).is_empty());
    }

    #[test]
    fn write_then_list_roundtrips() {
        let dir = tempdir().unwrap();
        let r = RunRecord {
            id: "run-9".into(),
            model: "m".into(),
            mode: "sft".into(),
            status: "running".into(),
            started_ms: 5,
            output_dir: "/x".into(),
            ..Default::default()
        };
        write_record(dir.path(), &r).unwrap();
        let runs = list_runs(dir.path());
        assert_eq!(runs.len(), 1);
        assert_eq!(runs[0].id, "run-9");
    }
}
