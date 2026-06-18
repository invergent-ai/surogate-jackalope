use crate::process::{self, SharedRun};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SftConfig {
    pub model: String,
    pub dataset: String,
    pub output_dir: String,
    pub precision: String,
    pub gpus: Vec<u32>,
    pub epochs: f64,
    pub learning_rate: f64,
}

/// Build a surogate YAML config string. Enables the surogate JSONL feed so the
/// Monitor can tail it.
pub fn build_yaml(c: &SftConfig) -> String {
    let gpus = c
        .gpus
        .iter()
        .map(|g| g.to_string())
        .collect::<Vec<_>>()
        .join(",");
    format!(
        "model_name_or_path: {model}\n\
         dataset_name: {dataset}\n\
         output_dir: {out}\n\
         precision: {prec}\n\
         cuda_visible_devices: \"{gpus}\"\n\
         num_train_epochs: {ep}\n\
         learning_rate: {lr}\n\
         logging_steps: 1\n\
         log_gpu_util: 5\n\
         report_to: [surogate]\n",
        model = c.model,
        dataset = c.dataset,
        out = c.output_dir.trim_end_matches('/'),
        prec = c.precision,
        gpus = gpus,
        ep = c.epochs,
        lr = c.learning_rate,
    )
}

pub fn build_args(config_path: &str) -> Vec<String> {
    vec!["sft".into(), "--config".into(), config_path.into()]
}

/// Write the config under the output dir, spawn surogate, return the run id.
/// `feed_path` is exported as SUROGATE_METRICS_PATH so the trainer writes the
/// metrics feed where the Monitor tails it.
pub fn start_sft(shared: &SharedRun, bin: &str, c: &SftConfig, feed_path: &str) -> Result<String, String> {
    let run_id = format!("run-{}", now_ms());
    let cfg_path = PathBuf::from(&c.output_dir).join(format!("{run_id}.yaml"));
    if let Some(parent) = cfg_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&cfg_path, build_yaml(c)).map_err(|e| e.to_string())?;
    let args = build_args(&cfg_path.to_string_lossy());
    let mut s = shared.lock();
    process::spawn(&mut s, bin, &args, &run_id, &[("SUROGATE_METRICS_PATH", feed_path)])?;
    Ok(run_id)
}

pub fn now_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> SftConfig {
        SftConfig {
            model: "Qwen/Qwen2.5-0.5B".into(),
            dataset: "tatsu-lab/alpaca".into(),
            output_dir: "/tmp/out".into(),
            precision: "bf16".into(),
            gpus: vec![0],
            epochs: 1.0,
            learning_rate: 0.0002,
        }
    }

    #[test]
    fn yaml_enables_surogate_feed() {
        let y = build_yaml(&sample());
        assert!(y.contains("report_to"));
        assert!(y.contains("surogate"));
        assert!(y.contains("logging_steps"));
        assert!(y.contains("Qwen/Qwen2.5-0.5B"));
    }

    #[test]
    fn yaml_trims_trailing_slash_in_output_dir() {
        let mut c = sample();
        c.output_dir = "/tmp/out/".into();
        let y = build_yaml(&c);
        assert!(y.contains("output_dir: /tmp/out\n"));
    }

    #[test]
    fn args_reference_written_config() {
        let args = build_args("/tmp/run.yaml");
        assert_eq!(
            args,
            vec![
                "sft".to_string(),
                "--config".to_string(),
                "/tmp/run.yaml".to_string()
            ]
        );
    }
}
