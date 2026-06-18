use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Provider {
    pub id: String,
    pub label: String,
    pub available: bool,
    pub detail: String,
}

fn on_path(bin: &str) -> bool {
    if let Ok(paths) = std::env::var("PATH") {
        for dir in std::env::split_paths(&paths) {
            let p = dir.join(bin);
            if p.is_file() {
                return true;
            }
            // Windows executables
            for ext in ["exe", "cmd", "bat"] {
                if dir.join(format!("{bin}.{ext}")).is_file() {
                    return true;
                }
            }
        }
    }
    false
}

fn home_has(rel: &str) -> bool {
    dirs::home_dir().map(|h| h.join(rel).exists()).unwrap_or(false)
}

/// Detect which compute providers the machine is set up for. Credentials always
/// live in each tool's native store — jackalope only reports availability.
pub fn detect() -> Vec<Provider> {
    vec![
        Provider {
            id: "local".into(),
            label: "Local GPUs".into(),
            available: on_path("nvidia-smi"),
            detail: if on_path("nvidia-smi") {
                "nvidia-smi found".into()
            } else {
                "no NVIDIA driver detected".into()
            },
        },
        Provider {
            id: "ssh".into(),
            label: "SSH".into(),
            available: on_path("ssh"),
            detail: if home_has(".ssh/config") {
                "ssh + ~/.ssh/config".into()
            } else {
                "ssh client".into()
            },
        },
        Provider {
            id: "modal".into(),
            label: "Modal".into(),
            available: on_path("modal"),
            detail: if home_has(".modal.toml") {
                "modal CLI + ~/.modal.toml".into()
            } else {
                "install: pip install modal".into()
            },
        },
        Provider {
            id: "dstack".into(),
            label: "dstack".into(),
            available: on_path("dstack"),
            detail: if home_has(".dstack/config.yml") {
                "dstack CLI + config".into()
            } else {
                "install: pip install dstack".into()
            },
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_returns_known_providers() {
        let ps = detect();
        let ids: Vec<&str> = ps.iter().map(|p| p.id.as_str()).collect();
        assert!(ids.contains(&"local"));
        assert!(ids.contains(&"ssh"));
        assert!(ids.contains(&"modal"));
        assert!(ids.contains(&"dstack"));
    }
}
