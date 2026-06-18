// Pull a finished run's outputs back to the local machine, dispatching by where
// the run ran. Ported from jackalope's artifacts.ts.
//   local  → already on disk (nothing to fetch)
//   ssh    → scp -r the remote output dir back
//   modal  → `modal volume get` the run's Volume
//   dstack → not downloadable (instance is torn down)

use crate::runs::RunRecord;
use crate::ssh;

pub struct FetchPlan {
    pub cmd: String,
    pub args: Vec<String>,
}

/// Decide how to fetch a run's artifacts into `dest`. Ok(None) = nothing to do
/// (local). Err = not fetchable. Pure → testable.
pub fn fetch_plan(r: &RunRecord, dest: &str) -> Result<Option<FetchPlan>, String> {
    match r.remote_kind.as_str() {
        "" | "local" => Ok(None),
        "ssh" => {
            let mut args = vec!["-r".to_string()];
            args.extend(ssh::scp_base_args(r.remote_port, &r.remote_identity));
            args.push(format!("{}:{}/output/.", r.remote_host, r.remote_dir));
            args.push(dest.to_string());
            Ok(Some(FetchPlan { cmd: "scp".into(), args }))
        }
        "modal" => Ok(Some(FetchPlan {
            cmd: "modal".into(),
            args: vec![
                "volume".into(), "get".into(), "--force".into(),
                r.remote_session.clone(), "/model".into(), dest.to_string(),
            ],
        })),
        "dstack" => Err(
            "dstack runs aren't downloadable (the instance is torn down) — push to the Hub, or use SSH/Modal".into(),
        ),
        other => Err(format!("unknown run kind: {other}")),
    }
}

/// Can this run's artifacts be fetched back?
pub fn is_fetchable(r: &RunRecord) -> bool {
    matches!(r.remote_kind.as_str(), "" | "local" | "ssh" | "modal")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rec(kind: &str) -> RunRecord {
        RunRecord { remote_kind: kind.into(), ..Default::default() }
    }

    #[test]
    fn local_has_no_plan() {
        assert!(fetch_plan(&rec(""), "/dest").unwrap().is_none());
    }

    #[test]
    fn ssh_uses_scp_recursive() {
        let mut r = rec("ssh");
        r.remote_host = "user@box".into();
        r.remote_dir = "~/runs/r1".into();
        let p = fetch_plan(&r, "/dest").unwrap().unwrap();
        assert_eq!(p.cmd, "scp");
        assert!(p.args.contains(&"-r".to_string()));
        assert!(p.args.contains(&"user@box:~/runs/r1/output/.".to_string()));
        assert!(p.args.contains(&"/dest".to_string()));
    }

    #[test]
    fn modal_uses_volume_get() {
        let mut r = rec("modal");
        r.remote_session = "jackalope-run1".into();
        let p = fetch_plan(&r, "/dest").unwrap().unwrap();
        assert_eq!(p.cmd, "modal");
        assert!(p.args.contains(&"jackalope-run1".to_string()));
        assert!(p.args.contains(&"/model".to_string()));
    }

    #[test]
    fn dstack_not_fetchable() {
        assert!(fetch_plan(&rec("dstack"), "/dest").is_err());
        assert!(!is_fetchable(&rec("dstack")));
    }
}
