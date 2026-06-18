// Remote compute over SSH: run surogate on a remote box inside a detached tmux
// session and mirror its metrics.jsonl back to the local feed via `ssh tail -F`,
// so the Monitor works unchanged. Ported from jackalope's ssh.ts.

use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
pub struct SshTarget {
    pub host: String,
    #[serde(default)]
    pub port: u32,
    #[serde(default)]
    pub identity_file: String,
    #[serde(default)]
    pub workdir: String,
}

/// Parse "user@host:port" / "host" / a ~/.ssh/config alias into host + port.
pub fn parse_target(s: &str) -> (String, u32) {
    let t = s.trim();
    if let Some(idx) = t.rfind(':') {
        let (h, p) = t.split_at(idx);
        if let Ok(port) = p[1..].parse::<u32>() {
            return (h.to_string(), port);
        }
    }
    (t.to_string(), 0)
}

/// Common non-interactive ssh options (fail fast, keepalives).
pub fn ssh_base_args(port: u32, identity: &str) -> Vec<String> {
    let mut a = vec![
        "-o".into(), "BatchMode=yes".into(),
        "-o".into(), "ConnectTimeout=10".into(),
        "-o".into(), "ServerAliveInterval=15".into(),
        "-o".into(), "ServerAliveCountMax=3".into(),
    ];
    if port != 0 {
        a.push("-p".into());
        a.push(port.to_string());
    }
    if !identity.is_empty() {
        a.push("-i".into());
        a.push(identity.into());
    }
    a
}

/// scp uses -P (capital) for port.
pub fn scp_base_args(port: u32, identity: &str) -> Vec<String> {
    let mut a = vec!["-o".into(), "BatchMode=yes".into(), "-o".into(), "ConnectTimeout=10".into()];
    if port != 0 {
        a.push("-P".into());
        a.push(port.to_string());
    }
    if !identity.is_empty() {
        a.push("-i".into());
        a.push(identity.into());
    }
    a
}

/// The detached tmux command that runs surogate on the remote. Pure → testable.
pub fn remote_launch_command(remote_dir: &str, session: &str, surogate_bin: &str) -> String {
    format!(
        "mkdir -p {dir} && tmux new-session -d -s {sess} \
         'cd {dir} && SUROGATE_METRICS_PATH={dir}/metrics.jsonl {bin} sft config.yaml > train.log 2>&1 < /dev/null'",
        dir = remote_dir,
        sess = session,
        bin = surogate_bin,
    )
}

/// Only allow the tmux-safe charset jackalope generates for session names.
pub fn safe_session(session: &str) -> bool {
    !session.is_empty() && session.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-'))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_host_and_port() {
        assert_eq!(parse_target("user@box:2222"), ("user@box".into(), 2222));
        assert_eq!(parse_target("myalias"), ("myalias".into(), 0));
    }

    #[test]
    fn launch_command_uses_tmux_and_feed() {
        let c = remote_launch_command("~/.surogate-watch/remote/r1", "sur_r1", "surogate");
        assert!(c.contains("tmux new-session -d -s sur_r1"));
        assert!(c.contains("SUROGATE_METRICS_PATH=~/.surogate-watch/remote/r1/metrics.jsonl"));
        assert!(c.contains("surogate sft config.yaml"));
    }

    #[test]
    fn session_name_validation() {
        assert!(safe_session("sur_r1.2-3"));
        assert!(!safe_session("evil; rm -rf"));
        assert!(!safe_session(""));
    }

    #[test]
    fn ssh_args_include_port_and_identity() {
        let a = ssh_base_args(22, "/k.pem");
        assert!(a.windows(2).any(|w| w == ["-p", "22"]));
        assert!(a.windows(2).any(|w| w == ["-i", "/k.pem"]));
    }
}
