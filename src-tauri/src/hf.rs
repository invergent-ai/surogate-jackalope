use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HfItem {
    pub id: String,
    pub downloads: u64,
    pub likes: u64,
}

/// Parse the HuggingFace `/api/models` or `/api/datasets` JSON array.
pub fn parse_items(json: &str) -> Vec<HfItem> {
    let val: serde_json::Value = match serde_json::from_str(json) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    val.as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|o| {
                    let id = o.get("id").and_then(|x| x.as_str())?.to_string();
                    Some(HfItem {
                        id,
                        downloads: o.get("downloads").and_then(|x| x.as_u64()).unwrap_or(0),
                        likes: o.get("likes").and_then(|x| x.as_u64()).unwrap_or(0),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

fn search(kind: &str, query: &str, token: Option<&str>) -> Result<Vec<HfItem>, String> {
    let q = urlencode(query);
    let url = format!(
        "https://huggingface.co/api/{kind}?search={q}&limit=25&sort=downloads&direction=-1"
    );
    let mut req = ureq::get(&url).timeout(Duration::from_secs(10));
    if let Some(t) = token {
        req = req.set("Authorization", &format!("Bearer {t}"));
    }
    match req.call() {
        Ok(resp) => {
            let body = resp.into_string().map_err(|e| e.to_string())?;
            Ok(parse_items(&body))
        }
        Err(e) => Err(format!("HuggingFace request failed: {e}")),
    }
}

pub fn search_models(query: &str, token: Option<&str>) -> Result<Vec<HfItem>, String> {
    search("models", query, token)
}

pub fn search_datasets(query: &str, token: Option<&str>) -> Result<Vec<HfItem>, String> {
    search("datasets", query, token)
}

fn urlencode(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            b' ' => "+".to_string(),
            _ => format!("%{:02X}", b),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_model_list() {
        let json = r#"[{"id":"Qwen/Qwen2.5-0.5B","downloads":12345,"likes":42},{"id":"meta-llama/Llama-3.2-1B","downloads":9999}]"#;
        let items = parse_items(json);
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].id, "Qwen/Qwen2.5-0.5B");
        assert_eq!(items[0].downloads, 12345);
        assert_eq!(items[1].likes, 0);
    }

    #[test]
    fn handles_garbage() {
        assert!(parse_items("nope").is_empty());
        assert!(parse_items("{}").is_empty());
    }

    #[test]
    fn urlencodes_spaces_and_slashes() {
        assert_eq!(urlencode("qwen 2.5/base"), "qwen+2.5%2Fbase");
    }
}
