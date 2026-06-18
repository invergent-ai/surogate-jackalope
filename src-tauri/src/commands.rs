use crate::cloud::{self, CloudOpts, DstackConfig, ModalConfig};
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
use base64::Engine;
use std::path::PathBuf;
use std::process::{Command, Stdio};
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
    // Terminate the cloud run first (by id/name), so killing the local streamer
    // never strands a paid GPU.
    match s.kind.as_str() {
        "dstack" => {
            if let Some(name) = s.cloud_name.clone() {
                let _ = Command::new("dstack").args(["stop", "-y", &name]).stdout(Stdio::null()).stderr(Stdio::null()).spawn();
            }
        }
        "modal" => {
            if let Some(dir) = s.artifact_dir.clone() {
                if let Ok(sid) = std::fs::read_to_string(PathBuf::from(&dir).join("sandbox.id")) {
                    let sid = sid.trim().to_string();
                    if !sid.is_empty() {
                        let py = format!("import modal; modal.Sandbox.from_id('{sid}').terminate()");
                        let _ = Command::new("uv").args(["run", "--with", "modal", "python", "-c", &py])
                            .stdout(Stdio::null()).stderr(Stdio::null()).spawn();
                    }
                }
            }
        }
        _ => {}
    }
    process::stop(&mut s);
    s.kind.clear();
    s.cloud_name = None;
    s.artifact_dir = None;
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

fn sanitize(s: &str, max: usize) -> String {
    s.chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' { c.to_ascii_lowercase() } else { '-' })
        .take(max)
        .collect()
}

/// Cloud options for the Launch UI (Modal image/GPUs, dstack backends).
#[tauri::command]
pub fn cloud_options() -> CloudOpts {
    cloud::cloud_opts()
}

/// Configure a dstack backend by merging creds into ~/.dstack/server/config.yml
/// (preserving other projects/backends). Creds go to dstack's own store.
#[tauri::command]
pub fn configure_dstack(backend: String, fields: serde_json::Map<String, serde_json::Value>) -> Result<(), String> {
    let cfg = dirs::home_dir().ok_or("no home dir")?.join(".dstack/server/config.yml");
    std::fs::create_dir_all(cfg.parent().unwrap()).map_err(|e| e.to_string())?;
    let existing: Option<serde_yaml::Value> = if cfg.exists() {
        let bak = cfg.with_extension("yml.bak");
        if !bak.exists() {
            let _ = std::fs::copy(&cfg, &bak);
        }
        let text = std::fs::read_to_string(&cfg).map_err(|e| e.to_string())?;
        Some(serde_yaml::from_str(&text).map_err(|e| format!("existing config not valid yaml: {e}"))?)
    } else {
        None
    };
    let doc = cloud::merge_dstack_backend(existing, &backend, &fields)?;
    let out = serde_yaml::to_string(&doc).map_err(|e| e.to_string())?;
    std::fs::write(&cfg, out).map_err(|e| e.to_string())
}

/// Launch a surogate SFT run on Modal via `uv run --with modal python`.
#[tauri::command]
pub fn launch_modal(
    app: AppHandle,
    config: SftConfig,
    modal: ModalConfig,
    srv: State<SharedRun>,
    cfg: State<AppConfig>,
) -> Result<String, String> {
    let (runs_dir, feed_path) = {
        let c = cfg.0.lock().unwrap();
        (c.runs_dir.clone(), c.feed_path.clone())
    };
    let run_id = format!("modal-{}", launch::now_ms());
    let art = PathBuf::from(&runs_dir).join(&run_id);
    std::fs::create_dir_all(&art).map_err(|e| e.to_string())?;

    let yaml = cloud::config_on_volume(&launch::build_yaml(&config));
    std::fs::write(art.join("config.yaml"), &yaml).map_err(|e| e.to_string())?;
    std::fs::write(art.join("modal_driver.py"), cloud::MODAL_DRIVER).map_err(|e| e.to_string())?;

    let volume = sanitize(&format!("jackalope-{run_id}"), 50);
    let cfg_b64 = base64::engine::general_purpose::STANDARD.encode(yaml.as_bytes());
    let mut cmd = Command::new("uv");
    cmd.args(["run", "--with", "modal", "python", "modal_driver.py"])
        .current_dir(&art)
        .env("JK_GPU", &modal.gpu)
        .env("JK_COUNT", modal.count.to_string())
        .env("JK_MODE", "sft")
        .env("JK_IMAGE", if modal.image.is_empty() { cloud::MODAL_DEFAULT_IMAGE.into() } else { modal.image.clone() })
        .env("JK_VOLUME", &volume)
        .env("JK_CONFIG_B64", cfg_b64)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    start_cloud(app, cmd, "modal", Some(volume), art.to_string_lossy().into_owned(),
        run_id, feed_path, &srv, &runs_dir, &config.model,
        "could not start the Modal driver — is uv installed?")
}

/// Launch a surogate SFT run on dstack via `dstack apply`.
#[tauri::command]
pub fn launch_dstack(
    app: AppHandle,
    config: SftConfig,
    dstack: DstackConfig,
    srv: State<SharedRun>,
    cfg: State<AppConfig>,
) -> Result<String, String> {
    let (runs_dir, feed_path, bin) = {
        let c = cfg.0.lock().unwrap();
        (c.runs_dir.clone(), c.feed_path.clone(), c.surogate_bin.clone())
    };
    let run_id = format!("dstack-{}", launch::now_ms());
    let art = PathBuf::from(&runs_dir).join(&run_id);
    std::fs::create_dir_all(&art).map_err(|e| e.to_string())?;

    let yaml = launch::build_yaml(&config);
    std::fs::write(art.join("config.yaml"), &yaml).map_err(|e| e.to_string())?;
    let name = sanitize(&format!("sur-{run_id}"), 40);
    std::fs::write(art.join("task.dstack.yml"), cloud::dstack_task_yaml(&name, &dstack, &yaml, &bin))
        .map_err(|e| e.to_string())?;

    let mut cmd = Command::new("dstack");
    cmd.args(["apply", "-y", "--name", &name, "-f", "task.dstack.yml"])
        .current_dir(&art)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    start_cloud(app, cmd, "dstack", Some(name), art.to_string_lossy().into_owned(),
        run_id, feed_path, &srv, &runs_dir, &config.model,
        "could not run dstack — is the CLI installed? (pip install dstack)")
}

/// Shared cloud-launch tail: spawn the streamer, pipe stdout into the feed,
/// register state, write a run record, and watch for exit.
#[allow(clippy::too_many_arguments)]
fn start_cloud(
    app: AppHandle,
    mut cmd: Command,
    kind: &str,
    cloud_name: Option<String>,
    artifact_dir: String,
    run_id: String,
    feed_path: String,
    srv: &SharedRun,
    runs_dir: &str,
    model: &str,
    spawn_err: &str,
) -> Result<String, String> {
    let _ = std::fs::write(&feed_path, ""); // fresh feed for this run
    let mut child = cmd.spawn().map_err(|e| format!("{spawn_err} ({e})"))?;
    process::stream_to_feed(app, &mut child, feed_path);
    {
        let mut s = srv.lock();
        process::stop(&mut s);
        s.child = Some(child);
        s.run_id = Some(run_id.clone());
        s.status = "launching".into();
        s.kind = kind.into();
        s.cloud_name = cloud_name;
        s.artifact_dir = Some(artifact_dir);
    }
    let _ = runs::write_record(std::path::Path::new(runs_dir), &RunRecord {
        id: run_id.clone(),
        model: model.to_string(),
        mode: "sft".into(),
        status: "running".into(),
        started_ms: launch::now_ms(),
        output_dir: format!("({kind})"),
    });

    let srv2 = srv.clone_handle();
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(1000));
        let mut s = srv2.lock();
        match s.child.as_mut() {
            Some(child) => match child.try_wait() {
                Ok(Some(status)) => {
                    let code = status.code().unwrap_or(-1);
                    s.status = if code == 0 { "idle".into() } else { format!("error: cloud run exited ({code})") };
                    s.child = None;
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
    });
    Ok(run_id)
}
