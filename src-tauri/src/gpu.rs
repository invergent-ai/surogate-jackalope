use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct GpuInfo {
    pub index: u32,
    pub name: String,
    pub util: u32,
    pub mem_used: u64,
    pub mem_total: u64,
    pub temp: u32,
    pub power: u32,
}

/// Parse `nvidia-smi --query-gpu=... --format=csv,noheader,nounits` output.
/// Expected columns: index, name, utilization.gpu, memory.used, memory.total,
/// temperature.gpu, power.draw
pub fn parse_nvidia_smi(out: &str) -> Vec<GpuInfo> {
    out.lines()
        .filter(|l| !l.trim().is_empty())
        .filter_map(|line| {
            let cols: Vec<String> = line.split(',').map(|c| c.trim().to_string()).collect();
            if cols.len() < 7 {
                return None;
            }
            Some(GpuInfo {
                index: cols[0].parse().unwrap_or(0),
                name: cols[1].clone(),
                util: cols[2].parse().unwrap_or(0),
                mem_used: cols[3].parse().unwrap_or(0),
                mem_total: cols[4].parse().unwrap_or(0),
                temp: cols[5].parse().unwrap_or(0),
                power: cols[6].parse::<f64>().map(|p| p as u32).unwrap_or(0),
            })
        })
        .collect()
}

/// Query local GPUs via nvidia-smi. Returns an empty vec if nvidia-smi is
/// missing or fails (e.g. no NVIDIA GPU) — the UI shows an empty state.
pub fn list_gpus() -> Vec<GpuInfo> {
    let out = Command::new("nvidia-smi")
        .args([
            "--query-gpu=index,name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw",
            "--format=csv,noheader,nounits",
        ])
        .output();
    match out {
        Ok(o) if o.status.success() => parse_nvidia_smi(&String::from_utf8_lossy(&o.stdout)),
        _ => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_two_gpus() {
        let csv = "0, NVIDIA RTX 4090, 92, 18000, 24564, 71, 250.5\n1, NVIDIA RTX 4090, 80, 17000, 24564, 65, 240.0";
        let gpus = parse_nvidia_smi(csv);
        assert_eq!(gpus.len(), 2);
        assert_eq!(gpus[0].name, "NVIDIA RTX 4090");
        assert_eq!(gpus[0].util, 92);
        assert_eq!(gpus[1].power, 240);
    }

    #[test]
    fn ignores_blank_and_short_lines() {
        assert!(parse_nvidia_smi("\n\nbad,line").is_empty());
    }
}
