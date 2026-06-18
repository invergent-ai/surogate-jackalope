use crate::config::{self, Config};
use crate::feed;
use crate::files::{self, FileEntry};
use crate::gpu::{self, GpuInfo};
use crate::hf::{self, HfItem};
use crate::launch::{self, SftConfig};
use crate::process::{self, SharedRun};
use crate::providers::{self, Provider};
use crate::runs::{self, RunRecord};
use crate::tips::{self, Tip};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

pub struct AppConfig(pub Mutex<Config>);

/// Holds the stop-flag of the currently running tail thread so a new
/// `start_monitor` call can cleanly stop the previous one.
pub struct TailStop(pub Mutex<Arc<AtomicBool>>);

impl TailStop {
    pub fn new() -> Self {
        TailStop(Mutex::new(Arc::new(AtomicBool::new(false))))
    }
}

#[tauri::command]
pub fn get_config(cfg: State<AppConfig>) -> Config {
    cfg.0.lock().unwrap().clone()
}

#[tauri::command]
pub fn set_config(new_cfg: Config, cfg: State<AppConfig>) -> Result<(), String> {
    *cfg.0.lock().unwrap() = new_cfg.clone();
    config::save_to(&config::config_path(), &new_cfg)
}

#[tauri::command]
pub fn start_monitor(
    app: AppHandle,
    from_start: bool,
    cfg: State<AppConfig>,
    tail: State<TailStop>,
) {
    let path = cfg.0.lock().unwrap().feed_path.clone();
    let mut slot = tail.0.lock().unwrap();
    slot.store(true, Ordering::Relaxed); // signal the previous tail to stop
    let fresh = Arc::new(AtomicBool::new(false));
    feed::spawn_tail(app, path, from_start, fresh.clone());
    *slot = fresh; // keep the new flag so we can stop it next time
}

#[tauri::command]
pub fn list_runs(cfg: State<AppConfig>) -> Vec<RunRecord> {
    let dir = cfg.0.lock().unwrap().runs_dir.clone();
    runs::list_runs(std::path::Path::new(&dir))
}

#[tauri::command]
pub fn list_gpus() -> Vec<GpuInfo> {
    gpu::list_gpus()
}

#[tauri::command]
pub fn list_tips() -> Vec<Tip> {
    tips::all_tips()
}

#[tauri::command]
pub fn list_providers() -> Vec<Provider> {
    providers::detect()
}

/// Return the surogate CLI version string, or null if it's not installed.
#[tauri::command]
pub fn surogate_version(cfg: State<AppConfig>) -> Option<String> {
    let bin = cfg.0.lock().unwrap().surogate_bin.clone();
    let out = std::process::Command::new(&bin).arg("--version").output().ok()?;
    let text = if out.stdout.is_empty() { out.stderr } else { out.stdout };
    let s = String::from_utf8_lossy(&text);
    s.lines().next().map(|l| l.trim().to_string()).filter(|l| !l.is_empty())
}

/// Mark the first-run setup as complete and persist the chosen compute target.
#[tauri::command]
pub fn complete_onboarding(compute: String, cfg: State<AppConfig>) -> Result<(), String> {
    let updated = {
        let mut c = cfg.0.lock().unwrap();
        c.onboarded = true;
        c.compute = compute;
        c.clone()
    };
    config::save_to(&config::config_path(), &updated)
}

#[tauri::command]
pub fn search_models(query: String) -> Result<Vec<HfItem>, String> {
    hf::search_models(&query, hf_token().as_deref())
}

#[tauri::command]
pub fn search_datasets(query: String) -> Result<Vec<HfItem>, String> {
    hf::search_datasets(&query, hf_token().as_deref())
}

#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<FileEntry>, String> {
    files::list_dir(std::path::Path::new(&path))
}

/// Read the standard huggingface-cli token if present, so Hub searches avoid
/// anonymous rate limits.
fn hf_token() -> Option<String> {
    let p = dirs::cache_dir()?.join("huggingface/token");
    std::fs::read_to_string(p).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

#[tauri::command]
pub fn run_status(srv: State<SharedRun>) -> String {
    srv.lock().status.clone()
}

#[tauri::command]
pub fn stop_run(srv: State<SharedRun>) {
    let mut s = srv.lock();
    process::stop(&mut s);
}

#[tauri::command]
pub fn launch_sft(
    app: AppHandle,
    config: SftConfig,
    srv: State<SharedRun>,
    cfg: State<AppConfig>,
) -> Result<String, String> {
    let (bin, runs_dir) = {
        let c = cfg.0.lock().unwrap();
        (c.surogate_bin.clone(), c.runs_dir.clone())
    };
    let run_id = launch::start_sft(&srv, &bin, &config)?;
    let _ = runs::write_record(
        std::path::Path::new(&runs_dir),
        &RunRecord {
            id: run_id.clone(),
            model: config.model.clone(),
            mode: "sft".into(),
            status: "running".into(),
            started_ms: launch::now_ms(),
            output_dir: config.output_dir.clone(),
        },
    );

    // Background watcher: flip to running, or report error on early exit.
    let srv2 = srv.inner().clone_handle();
    std::thread::spawn(move || {
        let deadline = Instant::now() + Duration::from_secs(180);
        loop {
            if Instant::now() > deadline {
                break;
            }
            {
                let mut s = srv2.lock();
                match s.child.as_mut() {
                    Some(child) => match child.try_wait() {
                        Ok(Some(_)) => {
                            let err = process::drain_stderr(&mut s);
                            process::stop(&mut s);
                            s.status = format!("error: surogate exited\n{err}");
                            let _ = app.emit("run-error", err);
                            break;
                        }
                        _ => {
                            if s.status == "launching" {
                                s.status = "running".into();
                            }
                        }
                    },
                    None => break,
                }
            }
            std::thread::sleep(Duration::from_millis(800));
        }
    });

    Ok(run_id)
}
