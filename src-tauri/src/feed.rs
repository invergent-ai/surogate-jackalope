use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct GpuStat {
    #[serde(default)]
    pub index: u32,
    #[serde(default)]
    pub util: u32,
    #[serde(default)]
    pub mem_used: u64,
    #[serde(default)]
    pub mem_total: u64,
    #[serde(default)]
    pub temp: u32,
    #[serde(default)]
    pub power: u32,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Metric {
    #[serde(default)]
    pub step: Option<u64>,
    #[serde(default)]
    pub epoch: Option<f64>,
    #[serde(default)]
    pub total_steps: Option<u64>,
    #[serde(default)]
    pub loss: Option<f64>,
    #[serde(default)]
    pub eval_loss: Option<f64>,
    #[serde(default)]
    pub lr: Option<f64>,
    #[serde(default)]
    pub grad_norm: Option<f64>,
    #[serde(default)]
    pub throughput: Option<f64>,
    #[serde(default)]
    pub phase: Option<String>,
    #[serde(default)]
    pub gpus: Vec<GpuStat>,
}

/// Parse one JSONL line into a Metric. Returns None for blank / non-JSON lines.
pub fn parse_line(line: &str) -> Option<Metric> {
    let line = line.trim();
    if line.is_empty() {
        return None;
    }
    serde_json::from_str::<Metric>(line).ok()
}

/// Tail `path`, emitting each parsed Metric as a "metric" event and each raw
/// non-JSON line as a "log" event. `from_start=false` seeks to EOF first so only
/// new lines are streamed. The loop exits when `stop` is set.
pub fn spawn_tail(app: AppHandle, path: String, from_start: bool, stop: Arc<AtomicBool>) {
    std::thread::spawn(move || {
        let mut pos: u64 = 0;
        let mut anchored = false;
        loop {
            if stop.load(Ordering::Relaxed) {
                break;
            }
            if let Ok(file) = std::fs::File::open(&path) {
                let mut reader = BufReader::new(file);
                if !from_start && !anchored {
                    pos = reader.seek(SeekFrom::End(0)).unwrap_or(0);
                    anchored = true;
                } else {
                    let _ = reader.seek(SeekFrom::Start(pos));
                    anchored = true;
                }
                let mut line = String::new();
                loop {
                    if stop.load(Ordering::Relaxed) {
                        break;
                    }
                    line.clear();
                    match reader.read_line(&mut line) {
                        Ok(0) => break,
                        Ok(n) => {
                            pos += n as u64;
                            match parse_line(&line) {
                                Some(m) => {
                                    let _ = app.emit("metric", &m);
                                }
                                None => {
                                    let trimmed = line.trim();
                                    if !trimmed.is_empty() {
                                        let _ = app.emit("log", trimmed.to_string());
                                    }
                                }
                            }
                        }
                        Err(_) => break,
                    }
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(400));
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_loss_line() {
        let line = r#"{"step":10,"loss":1.23,"lr":0.0002,"epoch":0.5}"#;
        let m = parse_line(line).expect("should parse");
        assert_eq!(m.step, Some(10));
        assert_eq!(m.loss, Some(1.23));
    }

    #[test]
    fn parses_gpu_line() {
        let line = r#"{"step":11,"gpus":[{"index":0,"util":92,"mem_used":18000,"mem_total":24000,"temp":71,"power":250}]}"#;
        let m = parse_line(line).unwrap();
        assert_eq!(m.gpus.len(), 1);
        assert_eq!(m.gpus[0].util, 92);
    }

    #[test]
    fn rejects_garbage() {
        assert!(parse_line("not json").is_none());
        assert!(parse_line("").is_none());
    }
}
