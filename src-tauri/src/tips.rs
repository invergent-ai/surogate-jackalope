use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Tip {
    pub title: String,
    pub body: String,
    pub topic: String,
}

fn tip(title: &str, body: &str, topic: &str) -> Tip {
    Tip {
        title: title.into(),
        body: body.into(),
        topic: topic.into(),
    }
}

/// Curated, grounded tips for surogate training — the desktop equivalent of
/// jackalope's live tips feed.
pub fn all_tips() -> Vec<Tip> {
    vec![
        tip(
            "Enable the metrics feed",
            "Set `report_to: [surogate]` with `logging_steps: 1` so the Monitor gets a point every step.",
            "monitor",
        ),
        tip(
            "Watch GPU memory headroom",
            "If mem% sits near 100, lower `per_device_train_batch_size` or enable gradient checkpointing before you OOM.",
            "gpus",
        ),
        tip(
            "FP8 for throughput",
            "On Hopper/Blackwell GPUs, `precision: fp8` can cut step time substantially with minimal quality loss for SFT.",
            "launch",
        ),
        tip(
            "Pick a trainable model",
            "Check the architecture badge before launching — surogate supports the common decoder LLM families out of the box.",
            "models",
        ),
        tip(
            "Log GPU utilisation",
            "`log_gpu_util: 5` samples util/temp/power every 5 steps so the meters stay live without slowing training.",
            "monitor",
        ),
        tip(
            "Grad norm spikes",
            "A climbing grad-norm with rising loss usually means the LR is too high — try halving `learning_rate`.",
            "launch",
        ),
        tip(
            "Resume from a run",
            "Each launch writes a config + record under the runs dir; re-open a run to replay its feed in the Monitor.",
            "runs",
        ),
        tip(
            "Credentials stay native",
            "Jackalope never stores cloud secrets — Modal uses ~/.modal.toml, dstack uses ~/.dstack, SSH uses ~/.ssh.",
            "providers",
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn has_tips_with_required_fields() {
        let tips = all_tips();
        assert!(tips.len() >= 5);
        assert!(tips.iter().all(|t| !t.title.is_empty() && !t.body.is_empty()));
    }
}
