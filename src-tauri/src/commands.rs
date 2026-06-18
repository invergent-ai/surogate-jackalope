use crate::config::{self, Config};
use crate::feed;
use crate::launch::{self, SftConfig};
use crate::process::{self, SharedRun};
use crate::runs::{self, RunRecord};
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
