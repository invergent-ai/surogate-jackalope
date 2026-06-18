use std::io::Read;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, MutexGuard};

#[derive(Default)]
pub struct RunState {
    pub child: Option<Child>,
    pub run_id: Option<String>,
    pub status: String, // idle | launching | running | error: <msg>
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

/// Spawn `bin` with `args`. Returns Ok once spawned; readiness is reported later
/// via `status` (caller's watcher thread polls). Spawn failure returns Err.
pub fn spawn(state: &mut RunState, bin: &str, args: &[String], run_id: &str) -> Result<(), String> {
    stop(state);
    let child = Command::new(bin)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to launch {bin}: {e}"))?;
    state.child = Some(child);
    state.run_id = Some(run_id.to_string());
    state.status = "launching".into();
    Ok(())
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
        spawn(&mut s, "sleep", &["30".into()], "run-1").unwrap();
        assert_eq!(s.status, "launching");
        assert_eq!(s.run_id.as_deref(), Some("run-1"));
        stop(&mut s);
    }
}
