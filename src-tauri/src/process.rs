use crate::feed;
use std::io::{BufRead, BufReader, Read};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, MutexGuard};
use tauri::{AppHandle, Emitter};

#[derive(Default)]
pub struct RunState {
    pub child: Option<Child>,
    pub run_id: Option<String>,
    pub status: String, // idle | launching | running | error: <msg>
    /// "local" | "modal" | "dstack" — drives provider-specific stop behaviour.
    pub kind: String,
    /// dstack run name / modal volume / ssh tmux session (for stop).
    pub cloud_name: Option<String>,
    /// Artifact dir holding config/driver/task files and (modal) sandbox.id.
    pub artifact_dir: Option<String>,
    /// SSH "host[:port][|identity]" so a remote run can be stopped.
    pub remote_host: Option<String>,
}

#[derive(Clone)]
pub struct SharedRun(pub Arc<Mutex<RunState>>);

impl SharedRun {
    pub fn new() -> Self {
        SharedRun(Arc::new(Mutex::new(RunState {
            status: "idle".into(),
            ..Default::default()
        })))
    }
    pub fn lock(&self) -> MutexGuard<'_, RunState> {
        self.0.lock().unwrap()
    }
    pub fn clone_handle(&self) -> SharedRun {
        self.clone()
    }
}

pub fn stop(state: &mut RunState) {
    if let Some(child) = state.child.as_mut() {
        let _ = child.kill();
        let _ = child.wait();
    }
    state.child = None;
    state.run_id = None;
    state.status = "idle".into();
}

/// Spawn `bin` with `args` and extra env vars. Returns Ok once spawned; readiness
/// is reported later via `status` (caller's watcher thread polls).
pub fn spawn(
    state: &mut RunState,
    bin: &str,
    args: &[String],
    run_id: &str,
    envs: &[(&str, &str)],
) -> Result<(), String> {
    stop(state);
    let mut cmd = Command::new(bin);
    cmd.args(args).stdout(Stdio::piped()).stderr(Stdio::piped());
    for (k, v) in envs {
        cmd.env(k, v);
    }
    let child = cmd.spawn().map_err(|e| format!("failed to launch {bin}: {e}"))?;
    state.child = Some(child);
    state.run_id = Some(run_id.to_string());
    state.status = "launching".into();
    Ok(())
}

/// Stream a cloud child's stdout: append metric JSONL lines to `feed_path` (so
/// the Monitor's tail shows them) and emit everything else as `log` events.
/// stderr is emitted as logs too. Consumes the child's piped handles.
pub fn stream_to_feed(app: AppHandle, child: &mut Child, feed_path: String) {
    if let Some(out) = child.stdout.take() {
        let app = app.clone();
        let feed = feed_path.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(out);
            for line in reader.lines().map_while(Result::ok) {
                if feed::parse_line(&line).is_some() {
                    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&feed) {
                        use std::io::Write;
                        let _ = writeln!(f, "{line}");
                    }
                } else if !line.trim().is_empty() {
                    let _ = app.emit("log", line);
                }
            }
        });
    }
    if let Some(err) = child.stderr.take() {
        let app = app.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(err);
            for line in reader.lines().map_while(Result::ok) {
                if !line.trim().is_empty() {
                    let _ = app.emit("log", line);
                }
            }
        });
    }
}

/// Read whatever stderr the child has produced (for error reporting).
pub fn drain_stderr(state: &mut RunState) -> String {
    let mut out = String::new();
    if let Some(child) = state.child.as_mut() {
        if let Some(err) = child.stderr.as_mut() {
            let mut buf = Vec::new();
            let _ = err.read_to_end(&mut buf);
            out = String::from_utf8_lossy(&buf).to_string();
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;
    use std::time::Duration;

    #[test]
    fn stop_kills_child() {
        let child = Command::new("sleep").arg("60").spawn().unwrap();
        let pid = child.id();
        let mut s = RunState {
            child: Some(child),
            run_id: Some("x".into()),
            status: "running".into(),
            ..Default::default()
        };
        stop(&mut s);
        assert!(s.child.is_none());
        assert_eq!(s.status, "idle");
        std::thread::sleep(Duration::from_millis(150));
        let alive = Command::new("kill")
            .args(["-0", &pid.to_string()])
            .status()
            .unwrap()
            .success();
        assert!(!alive);
    }

    #[test]
    fn spawn_sets_launching_status() {
        let mut s = RunState::default();
        spawn(&mut s, "sleep", &["30".into()], "run-1", &[]).unwrap();
        assert_eq!(s.status, "launching");
        assert_eq!(s.run_id.as_deref(), Some("run-1"));
        stop(&mut s);
    }
}
