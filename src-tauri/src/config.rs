use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Config {
    pub surogate_bin: String,
    pub feed_path: String,
    pub repo_root: String,
    pub runs_dir: String,
    /// Whether the first-run setup wizard has been completed.
    #[serde(default)]
    pub onboarded: bool,
    /// Chosen compute target: "local" | "ssh" | "modal" | "dstack".
    #[serde(default = "default_compute")]
    pub compute: String,
}

fn default_compute() -> String {
    "local".into()
}

impl Default for Config {
    fn default() -> Self {
        let tmp = std::env::temp_dir().join("surogate_metrics.jsonl");
        let runs = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("jackalope/runs");
        Config {
            surogate_bin: "surogate".into(),
            feed_path: tmp.to_string_lossy().into_owned(),
            repo_root: String::new(),
            runs_dir: runs.to_string_lossy().into_owned(),
            onboarded: false,
            compute: default_compute(),
        }
    }
}

pub fn config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("jackalope/config.json")
}

pub fn load_from(path: &Path) -> Config {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_to(path: &Path, cfg: &Config) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let s = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    std::fs::write(path, s).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn default_has_jsonl_feed_path() {
        let c = Config::default();
        assert!(c.feed_path.ends_with("surogate_metrics.jsonl"));
        assert_eq!(c.surogate_bin, "surogate");
    }

    #[test]
    fn save_then_load_roundtrips() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("config.json");
        let mut c = Config::default();
        c.surogate_bin = "/opt/surogate".into();
        save_to(&path, &c).unwrap();
        let loaded = load_from(&path);
        assert_eq!(loaded.surogate_bin, "/opt/surogate");
    }

    #[test]
    fn load_missing_returns_default() {
        let dir = tempdir().unwrap();
        let c = load_from(&dir.path().join("nope.json"));
        assert_eq!(c.surogate_bin, "surogate");
    }
}
