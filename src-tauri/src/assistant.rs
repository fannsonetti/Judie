//! Client for the Judie AI service (ai/README.md). Non-streaming: create a
//! session once, then POST each message with a unique request ID. A retry
//! reuses the same ID, so the service never runs a command twice.

use std::sync::atomic::{AtomicU32, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

static NEXT_ID: AtomicU32 = AtomicU32::new(0);

pub struct Reply {
    pub text: String,
    /// One chip per action Judie took, e.g. "Purifier Sleep · done".
    pub chips: Vec<String>,
}

pub enum Error {
    /// The service forgot the session (restart or expiry). Start a new one;
    /// don't resend, the command may already have run.
    SessionGone,
    /// No answer (network, timeout, server busy). Safe to retry with the same request ID.
    Failed(String),
}

/// Bearer token from `<data dir>/assistant-token` (kept out of layout.json).
pub fn token() -> Option<String> {
    let t = std::fs::read_to_string(crate::pi_room::data_dir().join("assistant-token")).ok()?;
    let t = t.trim().to_string();
    (!t.is_empty()).then_some(t)
}

pub fn request_id() -> String {
    let ms = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    format!("pi-{ms}-{}", NEXT_ID.fetch_add(1, Ordering::Relaxed))
}

fn agent() -> ureq::Agent {
    // CPU inference can take minutes; the README asks for at least 150 s.
    ureq::AgentBuilder::new().timeout_connect(Duration::from_secs(5)).timeout(Duration::from_secs(150)).build()
}

fn describe(e: ureq::Error) -> Error {
    match e {
        ureq::Error::Status(404, _) => Error::SessionGone,
        ureq::Error::Status(401, _) => Error::Failed("the assistant token was refused".into()),
        ureq::Error::Status(409, _) => Error::Failed("Judie is still busy with that".into()),
        ureq::Error::Status(code, _) => Error::Failed(format!("the service answered {code}")),
        ureq::Error::Transport(t) => Error::Failed(t.kind().to_string().to_lowercase()),
    }
}

pub fn new_session(base: &str, token: &str) -> Result<String, Error> {
    let v: serde_json::Value = agent()
        .post(&format!("{}/v1/sessions", base.trim_end_matches('/')))
        .set("Authorization", &format!("Bearer {token}"))
        .send_json(serde_json::json!({}))
        .map_err(describe)?
        .into_json()
        .map_err(|e| Error::Failed(e.to_string()))?;
    v["sessionId"].as_str().map(String::from).ok_or_else(|| Error::Failed("no session ID".into()))
}

pub fn end_session(base: &str, token: &str, session: &str) {
    let _ = agent()
        .delete(&format!("{}/v1/sessions/{session}", base.trim_end_matches('/')))
        .set("Authorization", &format!("Bearer {token}"))
        .call();
}

pub fn chat(base: &str, token: &str, session: &str, request_id: &str, message: &str) -> Result<Reply, Error> {
    let v: serde_json::Value = agent()
        .post(&format!("{}/v1/chat", base.trim_end_matches('/')))
        .set("Authorization", &format!("Bearer {token}"))
        .send_json(serde_json::json!({ "sessionId": session, "requestId": request_id, "message": message }))
        .map_err(describe)?
        .into_json()
        .map_err(|e| Error::Failed(e.to_string()))?;
    Ok(parse_reply(&v))
}

fn parse_reply(v: &serde_json::Value) -> Reply {
    let chips = v["actions"]
        .as_array()
        .map(|a| a.iter().map(chip).collect())
        .unwrap_or_default();
    Reply { text: v["reply"].as_str().unwrap_or("").trim().to_string(), chips }
}

fn chip(a: &serde_json::Value) -> String {
    let args = &a["arguments"];
    let what = [&args["id"], &args["value"]]
        .iter()
        .filter_map(|x| x.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    let what = if what.is_empty() { a["tool"].as_str().unwrap_or("action").replace('_', " ") } else { what };
    format!("{what} · {}", if a["ok"].as_bool() == Some(true) { "done" } else { "failed" })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reply_and_action_chips() {
        let v = serde_json::json!({
            "reply": " The purifier accepted Sleep mode. ",
            "actions": [
                { "tool": "device_control", "arguments": { "id": "purifier", "action": "set_preset_mode", "value": "Sleep" }, "ok": true },
                { "tool": "device_control", "arguments": { "id": "lamp" }, "ok": false, "error": "unknown device" }
            ]
        });
        let r = parse_reply(&v);
        assert_eq!(r.text, "The purifier accepted Sleep mode.");
        assert_eq!(r.chips, vec!["purifier Sleep · done", "lamp · failed"]);
        assert!(parse_reply(&serde_json::json!({ "reply": "hi" })).chips.is_empty());
    }

    #[test]
    fn request_ids_are_unique() {
        assert_ne!(request_id(), request_id());
    }
}
