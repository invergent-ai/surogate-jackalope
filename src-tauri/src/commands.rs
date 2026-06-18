use crate::artifacts;
use crate::cloud::{self, CloudOpts, DstackConfig, ModalConfig};
use crate::config::{self, Config};
use crate::feed;
use crate::files::{self, FileEntry};
use crate::gpu::{self, GpuInfo};
use crate::grpo;
use crate::hf::{self, HfItem};
use crate::launch::{self, SftConfig};
use crate::process::{self, SharedRun};
use crate::providers::{self, Provider};
use crate::runs::{self, RunRecord};
use crate::ssh;
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
        "ssh" => {
            if let (Some(session), Some(hostspec)) = (s.cloud_name.clone(), s.remote_host.clone()) {
                if ssh::safe_session(&session) {
                    let parts: Vec<&str> = hostspec.split('|').collect();
                    let host = parts.first().copied().unwrap_or("");
                    let port: u32 = parts.get(1).and_then(|p| p.parse().ok()).unwrap_or(0);
                    let identity = parts.get(2).copied().unwrap_or("");
                    let _ = Command::new("ssh")
                        .args(ssh::ssh_base_args(port, identity)).arg(host)
                        .arg(format!("tmux kill-session -t {session}"))
                        .stdout(Stdio::null()).stderr(Stdio::null()).spawn();
                }
            }
        }
        _ => {}
    }
    process::stop(&mut s);
    s.kind.clear();
    s.cloud_name = None;
    s.artifact_dir = None;
    s.remote_host = None;
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
            ..Default::default()
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
        remote_kind: kind.to_string(),
        // modal: the Volume name is the cloud_name; dstack isn't fetchable.
        remote_session: srv.lock().cloud_name.clone().unwrap_or_default(),
        ..Default::default()
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

/// Launch a surogate SFT run on a remote box over SSH: scp the config up, start
/// it in a detached tmux session, then mirror its metrics + log back via `ssh
/// tail -F` into the local feed.
#[tauri::command]
pub fn launch_ssh(
    app: AppHandle,
    config: SftConfig,
    target: ssh::SshTarget,
    srv: State<SharedRun>,
    cfg: State<AppConfig>,
) -> Result<String, String> {
    let (runs_dir, feed_path, bin) = {
        let c = cfg.0.lock().unwrap();
        (c.runs_dir.clone(), c.feed_path.clone(), c.surogate_bin.clone())
    };
    let (host, port) = ssh::parse_target(&target.host);
    let identity = target.identity_file.clone();
    let run_id = format!("ssh-{}", launch::now_ms());
    let art = PathBuf::from(&runs_dir).join(&run_id);
    std::fs::create_dir_all(&art).map_err(|e| e.to_string())?;
    let cfg_path = art.join("config.yaml");
    std::fs::write(&cfg_path, launch::build_yaml(&config)).map_err(|e| e.to_string())?;

    let base = if target.workdir.is_empty() { "~/.surogate-watch/remote".to_string() } else { target.workdir.clone() };
    let remote_dir = format!("{base}/{run_id}");
    let session = sanitize(&format!("sur_{run_id}"), 60).replace('-', "_");

    // 1) mkdir remote, 2) scp config up, 3) start detached tmux
    let mkdir = Command::new("ssh")
        .args(ssh::ssh_base_args(port, &identity)).arg(&host)
        .arg(format!("mkdir -p {remote_dir}"))
        .stdout(Stdio::null()).stderr(Stdio::piped())
        .output().map_err(|e| format!("ssh failed: {e}"))?;
    if !mkdir.status.success() {
        return Err(format!("ssh mkdir failed: {}", String::from_utf8_lossy(&mkdir.stderr).lines().next().unwrap_or("")));
    }
    let scp = Command::new("scp")
        .args(ssh::scp_base_args(port, &identity))
        .arg(&cfg_path).arg(format!("{host}:{remote_dir}/config.yaml"))
        .stdout(Stdio::null()).stderr(Stdio::piped())
        .output().map_err(|e| format!("scp failed: {e}"))?;
    if !scp.status.success() {
        return Err(format!("scp failed: {}", String::from_utf8_lossy(&scp.stderr).lines().next().unwrap_or("")));
    }
    let start = Command::new("ssh")
        .args(ssh::ssh_base_args(port, &identity)).arg(&host)
        .arg(ssh::remote_launch_command(&remote_dir, &session, &bin))
        .stdout(Stdio::null()).stderr(Stdio::piped())
        .output().map_err(|e| format!("ssh launch failed: {e}"))?;
    if !start.status.success() {
        return Err(format!("remote launch failed: {}", String::from_utf8_lossy(&start.stderr).lines().next().unwrap_or("")));
    }

    // fresh local feed, then mirror remote metrics into it and the log to events
    let _ = std::fs::write(&feed_path, "");
    let mut metric_tail = Command::new("ssh")
        .args(ssh::ssh_base_args(port, &identity)).arg(&host)
        .args(["tail", "-n", "+1", "-F", &format!("{remote_dir}/metrics.jsonl")])
        .stdout(Stdio::piped()).stderr(Stdio::null())
        .spawn().map_err(|e| format!("ssh tail failed: {e}"))?;
    process::stream_to_feed(app, &mut metric_tail, feed_path);

    {
        let mut s = srv.lock();
        process::stop(&mut s);
        s.child = Some(metric_tail);
        s.run_id = Some(run_id.clone());
        s.status = "running".into();
        s.kind = "ssh".into();
        s.cloud_name = Some(session.clone());
        s.remote_host = Some(format!("{host}|{port}|{identity}"));
    }
    let _ = runs::write_record(std::path::Path::new(&runs_dir), &RunRecord {
        id: run_id.clone(),
        model: config.model.clone(),
        mode: "sft".into(),
        status: "running".into(),
        started_ms: launch::now_ms(),
        output_dir: format!("ssh:{host}"),
        remote_kind: "ssh".into(),
        remote_host: host,
        remote_dir,
        remote_session: session,
        remote_port: port,
        remote_identity: identity,
    });
    Ok(run_id)
}

/// Launch a local GRPO / RULER run (split-GPU RL). Generates the managed
/// train/infer/orch[/judge] configs and runs `surogate grpo` with the GPU split.
#[tauri::command]
pub fn launch_grpo(
    app: AppHandle,
    ruler: bool,
    trainer_gpus: Vec<u32>,
    vllm_gpus: Vec<u32>,
    judge_gpus: Vec<u32>,
    srv: State<SharedRun>,
    cfg: State<AppConfig>,
) -> Result<String, String> {
    let (runs_dir, feed_path, bin, repo_root) = {
        let c = cfg.0.lock().unwrap();
        (c.runs_dir.clone(), c.feed_path.clone(), c.surogate_bin.clone(), c.repo_root.clone())
    };
    if trainer_gpus.is_empty() || vllm_gpus.is_empty() {
        return Err("GRPO needs at least one trainer GPU and one vLLM GPU".into());
    }
    if ruler && judge_gpus.is_empty() {
        return Err("RULER needs at least one judge GPU".into());
    }
    let mode = if ruler { "ruler" } else { "grpo" };
    let run_id = format!("{mode}-{}", launch::now_ms());
    let art = PathBuf::from(&runs_dir).join(&run_id);
    std::fs::create_dir_all(&art).map_err(|e| e.to_string())?;

    // resolve the shipped reward env from the repo, if configured
    let env_path = if repo_root.is_empty() {
        None
    } else {
        let d = PathBuf::from(&repo_root).join("environments").join(grpo::RL_ENV_ID);
        if d.join(format!("{}.py", grpo::RL_ENV_ID.replace('-', "_"))).exists() {
            Some(d.to_string_lossy().into_owned())
        } else {
            None
        }
    };

    let train = art.join("train.yaml");
    let infer = art.join("infer.yaml");
    let orch = art.join("orch.yaml");
    std::fs::write(&train, grpo::train_yaml()).map_err(|e| e.to_string())?;
    std::fs::write(&infer, grpo::infer_yaml(grpo::STUDENT_PORT)).map_err(|e| e.to_string())?;
    let orch_yaml = if ruler { grpo::ruler_orch_yaml(env_path.as_deref()) } else { grpo::grpo_orch_yaml(env_path.as_deref()) };
    std::fs::write(&orch, orch_yaml).map_err(|e| e.to_string())?;
    let judge = if ruler {
        let j = art.join("judge.yaml");
        std::fs::write(&j, grpo::judge_yaml(grpo::JUDGE_PORT)).map_err(|e| e.to_string())?;
        Some(j)
    } else {
        None
    };

    let args = grpo::build_grpo_args(
        &train.to_string_lossy(),
        &infer.to_string_lossy(),
        &orch.to_string_lossy(),
        &trainer_gpus,
        &vllm_gpus,
        judge.as_ref().map(|p| p.to_string_lossy().into_owned()).as_deref(),
        &judge_gpus,
    );

    let _ = std::fs::write(&feed_path, "");
    let mut child = Command::new(&bin)
        .args(&args)
        .current_dir(&art)
        .env("SUROGATE_METRICS_PATH", &feed_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to launch {bin}: {e}"))?;
    // surogate writes metrics to the feed itself; pipe its stdout/stderr to logs.
    process::stream_to_feed(app, &mut child, feed_path);
    {
        let mut s = srv.lock();
        process::stop(&mut s);
        s.child = Some(child);
        s.run_id = Some(run_id.clone());
        s.status = "running".into();
        s.kind = "local".into();
    }
    let _ = runs::write_record(std::path::Path::new(&runs_dir), &RunRecord {
        id: run_id.clone(),
        model: "Qwen/Qwen3-0.6B".into(),
        mode: mode.into(),
        status: "running".into(),
        started_ms: launch::now_ms(),
        output_dir: art.to_string_lossy().into_owned(),
        ..Default::default()
    });

    let srv2 = srv.clone_handle();
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(1000));
        let mut s = srv2.lock();
        match s.child.as_mut() {
            Some(c) => match c.try_wait() {
                Ok(Some(st)) => {
                    let code = st.code().unwrap_or(-1);
                    s.status = if code == 0 { "idle".into() } else { format!("error: run exited ({code})") };
                    s.child = None;
                    break;
                }
                _ => {}
            },
            None => break,
        }
    });
    Ok(run_id)
}

/// Fetch a finished run's artifacts back to <run-dir>/output (ssh: scp, modal:
/// `modal volume get`). Streams the transfer output as `log` events.
#[tauri::command]
pub fn fetch_artifacts(app: AppHandle, run_id: String, cfg: State<AppConfig>) -> Result<String, String> {
    let runs_dir = cfg.0.lock().unwrap().runs_dir.clone();
    let record_path = std::path::Path::new(&runs_dir).join(format!("{run_id}.json"));
    let text = std::fs::read_to_string(&record_path).map_err(|_| format!("run record not found: {run_id}"))?;
    let record: RunRecord = serde_json::from_str(&text).map_err(|e| e.to_string())?;

    let dest = PathBuf::from(&runs_dir).join(&run_id).join("output");
    std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    let dest_s = dest.to_string_lossy().into_owned();

    match artifacts::fetch_plan(&record, &dest_s)? {
        None => Ok(dest_s), // local — already on disk
        Some(plan) => {
            let _ = app.emit("log", format!("fetch: {} {}", plan.cmd, plan.args.join(" ")));
            let out = Command::new(&plan.cmd)
                .args(&plan.args)
                .output()
                .map_err(|e| format!("{} failed: {e}", plan.cmd))?;
            for line in String::from_utf8_lossy(&out.stdout).lines().chain(String::from_utf8_lossy(&out.stderr).lines()) {
                let _ = app.emit("log", line.to_string());
            }
            if out.status.success() {
                Ok(dest_s)
            } else {
                Err(format!("{} exited with {}", plan.cmd, out.status.code().unwrap_or(-1)))
            }
        }
    }
}
