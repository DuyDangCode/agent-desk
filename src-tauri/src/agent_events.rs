use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub agent: String,
    #[serde(alias = "session_id", skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(alias = "terminal_id", skip_serializing_if = "Option::is_none")]
    pub terminal_id: Option<String>,
    #[serde(alias = "workspace_id", skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<u64>,
}

/// Dispatches native desktop notification on Ubuntu/Linux using notify-send
pub fn send_desktop_notification(
    title: &str,
    body: &str,
    urgency: Option<&str>,
) -> Result<(), String> {
    let mut cmd = Command::new("notify-send");
    cmd.arg(title).arg(body);
    cmd.arg("-a").arg("AgentDeck");

    let urg = urgency.unwrap_or("normal");
    cmd.arg("-u").arg(urg);

    // Provide app icon if available
    let icon_candidates = [
        "/home/thanhduy/Projects/agent_deck/src-tauri/icons/128x128.png",
        "agent-deck",
        "utilities-terminal",
    ];

    for candidate in icon_candidates {
        if Path::new(candidate).exists() || !candidate.contains('/') {
            cmd.arg("-i").arg(candidate);
            break;
        }
    }

    match cmd.spawn() {
        Ok(_) => Ok(()),
        Err(e) => {
            log::warn!("notify-send error: {}", e);
            Err(format!("Failed to trigger desktop notification: {}", e))
        }
    }
}

/// Spawns a background localhost HTTP listener to receive agent events from bridge CLI
pub fn spawn_event_listener(app: AppHandle, port: u16) {
    std::thread::Builder::new()
        .name("agentdeck-event-listener".to_string())
        .spawn(move || {
            let rt = match tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
            {
                Ok(r) => r,
                Err(e) => {
                    log::error!("Failed to build Tokio runtime for agent_events listener: {}", e);
                    return;
                }
            };

            rt.block_on(async move {
                let addr = format!("127.0.0.1:{}", port);
                let listener = match TcpListener::bind(&addr).await {
                    Ok(l) => {
                        log::info!("AgentDeck Desktop Event Listener running on http://{}", addr);
                        l
                    }
                    Err(e) => {
                        log::warn!(
                            "Port {} already bound (e.g. by agent-deck-server): {}. Trying fallback 4022",
                            port,
                            e
                        );
                        match TcpListener::bind("127.0.0.1:4022").await {
                            Ok(fallback_l) => {
                                log::info!("AgentDeck Desktop Event Listener running on fallback http://127.0.0.1:4022");
                                fallback_l
                            }
                            Err(e2) => {
                                log::warn!("Event listener fallback port 4022 also unavailable: {}", e2);
                                return;
                            }
                        }
                    }
                };

                loop {
                    if let Ok((mut stream, _)) = listener.accept().await {
                        let app_handle = app.clone();
                        tokio::spawn(async move {
                            let mut buf = [0u8; 8192];
                            let mut total_read = 0;
                            let mut body_start = None;
                            let mut content_length = None;

                            // Read headers
                            while total_read < buf.len() {
                                match stream.read(&mut buf[total_read..]).await {
                                    Ok(0) => break,
                                    Ok(n) => {
                                        total_read += n;
                                        let slice = &buf[..total_read];
                                        if let Some(pos) = slice.windows(4).position(|w| w == b"\r\n\r\n") {
                                            body_start = Some(pos + 4);
                                            let headers = String::from_utf8_lossy(&slice[..pos]);
                                            for line in headers.lines() {
                                                if line.to_lowercase().starts_with("content-length:") {
                                                    if let Some(val) = line.split(':').nth(1) {
                                                        content_length = val.trim().parse::<usize>().ok();
                                                    }
                                                }
                                            }
                                            break;
                                        }
                                    }
                                    Err(_) => break,
                                }
                            }

                            let mut body_bytes = Vec::new();
                            if let Some(start) = body_start {
                                body_bytes.extend_from_slice(&buf[start..total_read]);
                                if let Some(cl) = content_length {
                                    while body_bytes.len() < cl {
                                        let mut temp = [0u8; 2048];
                                        match stream.read(&mut temp).await {
                                            Ok(0) => break,
                                            Ok(n) => body_bytes.extend_from_slice(&temp[..n]),
                                            Err(_) => break,
                                        }
                                    }
                                }
                            }

                            if let Ok(event) = serde_json::from_slice::<AgentEvent>(&body_bytes) {
                                log::info!("Received desktop agent event: {:?}", event);
                                let _ = app_handle.emit("agent-event", &event);

                                let resp = b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{\"status\":\"ok\"}\n";
                                let _ = stream.write_all(resp).await;
                            } else {
                                let resp = b"HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{\"error\":\"Invalid agent event payload\"}\n";
                                let _ = stream.write_all(resp).await;
                            }
                        });
                    }
                }
            });
        })
        .ok();
}
