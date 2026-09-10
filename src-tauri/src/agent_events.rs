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
                                            let first_line = headers.lines().next().unwrap_or("").trim().to_string();

                                            // 1. CORS Preflight
                                            if first_line.starts_with("OPTIONS") {
                                                let resp = b"HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS\r\nAccess-Control-Allow-Headers: *\r\nConnection: close\r\n\r\n";
                                                let _ = stream.write_all(resp).await;
                                                return;
                                            }

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

                            let slice = &buf[..total_read];
                            let header_str = if let Some(pos) = slice.windows(4).position(|w| w == b"\r\n\r\n") {
                                String::from_utf8_lossy(&slice[..pos]).to_string()
                            } else {
                                String::new()
                            };
                            let first_line = header_str.lines().next().unwrap_or("").trim().to_string();

                            // 2. Agent Events Endpoints
                            if first_line.starts_with("POST /agent-events") || first_line.starts_with("POST /api/agent-events") {
                                if let Ok(event) = serde_json::from_slice::<AgentEvent>(&body_bytes) {
                                    log::info!("Received desktop agent event: {:?}", event);
                                    let _ = app_handle.emit("agent-event", &event);
                                    let resp = b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{\"status\":\"ok\"}\n";
                                    let _ = stream.write_all(resp).await;
                                } else {
                                    let resp = b"HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{\"error\":\"Invalid agent event payload\"}\n";
                                    let _ = stream.write_all(resp).await;
                                }
                                return;
                            }

                            // 2b. Component Picked Endpoint (dispatched from native webviews or external browsers)
                            if first_line.starts_with("POST /api/component-picked") || first_line.starts_with("POST /component-picked") {
                                if let Ok(payload) = serde_json::from_slice::<serde_json::Value>(&body_bytes) {
                                    log::info!("Received component picked event via HTTP: {:?}", payload);
                                    let _ = app_handle.emit("agentdeck:component-picked", &payload);
                                    let resp = b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{\"status\":\"ok\"}\n";
                                    let _ = stream.write_all(resp).await;
                                } else {
                                    let resp = b"HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{\"error\":\"Invalid payload\"}\n";
                                    let _ = stream.write_all(resp).await;
                                }
                                return;
                            }

                            // 2c. Component Steer Endpoint (dispatched from in-window steer modal)
                            if first_line.starts_with("POST /api/component-steer") || first_line.starts_with("POST /component-steer") {
                                if let Ok(payload) = serde_json::from_slice::<serde_json::Value>(&body_bytes) {
                                    log::info!("Received component steer event via HTTP: {:?}", payload);
                                    let _ = app_handle.emit("agentdeck:steer-component", &payload);
                                    let _ = crate::commands::focus_app_window(app_handle.clone());
                                    let resp = b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{\"status\":\"ok\"}\n";
                                    let _ = stream.write_all(resp).await;
                                } else {
                                    let resp = b"HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{\"error\":\"Invalid payload\"}\n";
                                    let _ = stream.write_all(resp).await;
                                }
                                return;
                            }

                            // 3. Smart Proxy Full Gateway (Proxies HTML, JS modules, CSS, chunks, images, APIs)
                            let mut headers_vec = Vec::new();
                            for line in header_str.lines().skip(1) {
                                if let Some(c) = line.find(':') {
                                    headers_vec.push((line[..c].trim().to_string(), line[c + 1..].trim().to_string()));
                                }
                            }
                            let method = first_line.split_whitespace().next().unwrap_or("GET").to_string();
                            let (target_port, forward_path) = crate::preview::resolve_request_target_port(&first_line, &headers_vec);

                            match crate::preview::forward_proxy_request(target_port, &method, &forward_path, &headers_vec, &body_bytes).await {
                                Ok(res) => {
                                    let reason = match res.status_code {
                                        200 => "OK",
                                        201 => "Created",
                                        204 => "No Content",
                                        206 => "Partial Content",
                                        301 => "Moved Permanently",
                                        302 => "Found",
                                        304 => "Not Modified",
                                        400 => "Bad Request",
                                        401 => "Unauthorized",
                                        403 => "Forbidden",
                                        404 => "Not Found",
                                        500 => "Internal Server Error",
                                        502 => "Bad Gateway",
                                        503 => "Service Unavailable",
                                        504 => "Gateway Timeout",
                                        _ => "",
                                    };
                                    let mut head_str = format!(
                                        "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n",
                                        res.status_code, reason, res.content_type, res.body.len()
                                    );
                                    for (k, v) in &res.headers {
                                        if !k.eq_ignore_ascii_case("content-type") && !k.eq_ignore_ascii_case("content-length") && !k.eq_ignore_ascii_case("connection") {
                                            head_str.push_str(&format!("{}: {}\r\n", k, v));
                                        }
                                    }
                                    head_str.push_str("\r\n");
                                    let _ = stream.write_all(head_str.as_bytes()).await;
                                    if !res.body.is_empty() {
                                        let _ = stream.write_all(&res.body).await;
                                    }
                                }
                                Err(err) => {
                                    if method == "GET" && (forward_path == "/" || forward_path.ends_with(".html") || !forward_path.contains('.')) {
                                        let offline = crate::preview::render_dev_server_offline_html(&format!("http://localhost:{}", target_port));
                                        let resp = format!(
                                            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}",
                                            offline.len(),
                                            offline
                                        );
                                        let _ = stream.write_all(resp.as_bytes()).await;
                                    } else {
                                        let resp = format!(
                                            "HTTP/1.1 502 Bad Gateway\r\nContent-Type: text/plain; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\nContent-Length: {}\r\n\r\nProxy error: {}",
                                            err.len() + 13,
                                            err
                                        );
                                        let _ = stream.write_all(resp.as_bytes()).await;
                                    }
                                }
                            }
                        });
                    }
                }
            });
        })
        .ok();
}
