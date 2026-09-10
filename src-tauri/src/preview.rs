use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU16, Ordering};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewPageResult {
    pub success: bool,
    pub status_code: u16,
    pub content_type: String,
    pub body: String,
    pub final_url: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyResponse {
    pub status_code: u16,
    pub content_type: String,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

pub static LAST_PREVIEW_PORT: AtomicU16 = AtomicU16::new(5173);

pub fn set_last_preview_port(port: u16) {
    if port > 0 {
        LAST_PREVIEW_PORT.store(port, Ordering::Relaxed);
    }
}

pub fn get_last_preview_port() -> u16 {
    let p = LAST_PREVIEW_PORT.load(Ordering::Relaxed);
    if p == 0 {
        5173
    } else {
        p
    }
}

/// Parses a URL into (scheme, host, port, path_and_query)
pub fn parse_target_url(input: &str) -> Result<(String, String, u16, String), String> {
    let trimmed = input.trim();
    let clean = if trimmed.is_empty() {
        "http://localhost:5173".to_string()
    } else if trimmed.chars().all(|c| c.is_ascii_digit()) {
        format!("http://localhost:{}", trimmed)
    } else if trimmed.starts_with(':') && trimmed[1..].chars().all(|c| c.is_ascii_digit()) {
        format!("http://localhost{}", trimmed)
    } else if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        format!("http://{}", trimmed)
    } else {
        trimmed.to_string()
    };

    let scheme = if clean.starts_with("https://") {
        "https"
    } else {
        "http"
    };

    let rest = &clean[scheme.len() + 3..];
    let (authority, path_query) = match rest.find('/') {
        Some(pos) => (&rest[..pos], &rest[pos..]),
        None => (rest, "/"),
    };

    let (host, port) = match authority.rfind(':') {
        Some(pos) => {
            let h = &authority[..pos];
            let p = authority[pos + 1..]
                .parse::<u16>()
                .unwrap_or(if scheme == "https" { 443 } else { 80 });
            (h, p)
        }
        None => (authority, if scheme == "https" { 443 } else { 80 }),
    };

    let resolved_host = if host.is_empty() || host == "localhost" {
        "127.0.0.1".to_string()
    } else {
        host.to_string()
    };

    let final_path = if path_query.is_empty() { "/" } else { path_query };

    Ok((
        scheme.to_string(),
        resolved_host,
        port,
        final_path.to_string(),
    ))
}

/// Parses raw HTTP wire response text into PreviewPageResult
pub fn parse_http_raw_response(raw: &str, final_url: &str) -> Result<PreviewPageResult, String> {
    // If multiple HTTP responses (e.g. 301/302 redirects from curl -sSL -i), pick the final response block
    let target_slice = if let Some(last_http_pos) = raw.rfind("\r\nHTTP/") {
        &raw[last_http_pos + 2..]
    } else if let Some(last_http_pos) = raw.rfind("\nHTTP/") {
        &raw[last_http_pos + 1..]
    } else {
        raw
    };

    let (headers_part, body_part) = if let Some(pos) = target_slice.find("\r\n\r\n") {
        (&target_slice[..pos], &target_slice[pos + 4..])
    } else if let Some(pos) = target_slice.find("\n\n") {
        (&target_slice[..pos], &target_slice[pos + 2..])
    } else {
        ("", target_slice)
    };

    let mut status_code = 200u16;
    let mut content_type = "text/html; charset=utf-8".to_string();

    let lines: Vec<&str> = headers_part.lines().collect();
    if let Some(first_line) = lines.first() {
        let parts: Vec<&str> = first_line.split_whitespace().collect();
        if parts.len() >= 2 {
            if let Ok(code) = parts[1].parse::<u16>() {
                status_code = code;
            }
        }
    }

    for line in &lines {
        let lower = line.to_lowercase();
        if lower.starts_with("content-type:") {
            if let Some(val) = line.split(':').nth(1) {
                content_type = val.trim().to_string();
            }
        }
    }

    Ok(PreviewPageResult {
        success: status_code < 400,
        status_code,
        content_type,
        body: body_part.to_string(),
        final_url: final_url.to_string(),
        error: if status_code >= 400 {
            Some(format!("HTTP Error {}", status_code))
        } else {
            None
        },
    })
}

/// Fetches target URL content using localhost TCP or curl fallback
pub async fn fetch_url_internal(url_str: &str) -> Result<PreviewPageResult, String> {
    let clean_url = if !url_str.starts_with("http://") && !url_str.starts_with("https://") {
        format!("http://{}", url_str.trim())
    } else {
        url_str.trim().to_string()
    };

    let (_scheme, host, port, path_str) = parse_target_url(&clean_url)?;

    // Try curl first for robust HTTP handling (auto decompression, redirects, chunked transfer-encoding)
    let curl_res = tokio::process::Command::new("curl")
        .arg("-sSL")
        .arg("-i")
        .arg("--compressed")
        .arg("--max-time")
        .arg("5")
        .arg("-A")
        .arg("Mozilla/5.0 (X11; Linux x86_64) AgentDeck/2.0")
        .arg(&clean_url)
        .output()
        .await;

    if let Ok(out) = curl_res {
        if !out.stdout.is_empty() {
            let full_output = String::from_utf8_lossy(&out.stdout).to_string();
            return parse_http_raw_response(&full_output, &clean_url);
        }
    }

    // Localhost dev server connection via fast Tokio TcpStream
    let addr = format!("{}:{}", host, port);
    let mut stream = match tokio::time::timeout(
        std::time::Duration::from_secs(5),
        TcpStream::connect(&addr),
    )
    .await
    {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => {
            return Ok(PreviewPageResult {
                success: false,
                status_code: 503,
                content_type: "text/plain".to_string(),
                body: format!("Could not connect to {}: {}", addr, e),
                final_url: clean_url,
                error: Some(format!("Connection refused on {}: {}", addr, e)),
            });
        }
        Err(_) => {
            return Ok(PreviewPageResult {
                success: false,
                status_code: 504,
                content_type: "text/plain".to_string(),
                body: format!("Connection timed out connecting to {}", addr),
                final_url: clean_url,
                error: Some(format!("Connection timed out connecting to {}", addr)),
            });
        }
    };

    let req_bytes = format!(
        "GET {} HTTP/1.1\r\nHost: {}:{}\r\nUser-Agent: Mozilla/5.0 AgentDeck/2.0\r\nAccept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n",
        path_str, host, port
    );

    if let Err(e) = stream.write_all(req_bytes.as_bytes()).await {
        return Ok(PreviewPageResult {
            success: false,
            status_code: 500,
            content_type: "text/plain".to_string(),
            body: format!("Write error to {}: {}", addr, e),
            final_url: clean_url,
            error: Some(e.to_string()),
        });
    }

    let mut response_bytes = Vec::new();
    let mut buf = [0u8; 8192];
    loop {
        match stream.read(&mut buf).await {
            Ok(0) => break,
            Ok(n) => response_bytes.extend_from_slice(&buf[..n]),
            Err(e) => {
                log::warn!("Stream read error: {}", e);
                break;
            }
        }
    }

    let raw_text = String::from_utf8_lossy(&response_bytes).to_string();
    parse_http_raw_response(&raw_text, &clean_url)
}

/// Decodes HTTP chunked transfer-encoding body bytes
pub fn decode_chunked_body(input: &[u8]) -> Vec<u8> {
    let mut cursor = 0;
    let mut decoded = Vec::new();
    while cursor < input.len() {
        let remainder = &input[cursor..];
        let crlf_pos = match remainder.windows(2).position(|w| w == b"\r\n") {
            Some(p) => p,
            None => break,
        };
        let line_str = match std::str::from_utf8(&remainder[..crlf_pos]) {
            Ok(s) => s.trim(),
            Err(_) => break,
        };
        // Strip chunk extensions if any (e.g. "1a;ext=foo")
        let chunk_size_str = line_str.split(';').next().unwrap_or("").trim();
        let chunk_size = match usize::from_str_radix(chunk_size_str, 16) {
            Ok(s) => s,
            Err(_) => break,
        };
        cursor += crlf_pos + 2;
        if chunk_size == 0 {
            break;
        }
        if cursor + chunk_size > input.len() {
            decoded.extend_from_slice(&input[cursor..]);
            break;
        }
        decoded.extend_from_slice(&input[cursor..cursor + chunk_size]);
        cursor += chunk_size;
        // Skip trailing \r\n after chunk data
        if cursor + 2 <= input.len() && &input[cursor..cursor + 2] == b"\r\n" {
            cursor += 2;
        }
    }
    if decoded.is_empty() && !input.is_empty() {
        input.to_vec()
    } else {
        decoded
    }
}

/// Simple percent-decoder for query parameters
pub fn urlencoding_decode(input: &str) -> String {
    let mut out = Vec::new();
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(val) = u8::from_str_radix(std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or(""), 16) {
                out.push(val);
                i += 3;
                continue;
            }
        }
        if bytes[i] == b'+' {
            out.push(b' ');
        } else {
            out.push(bytes[i]);
        }
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

/// Extracts target port and forward path from incoming request line and headers
pub fn resolve_request_target_port(
    request_line: &str,
    headers: &[(String, String)],
) -> (u16, String) {
    let trimmed = request_line.trim();
    let parts: Vec<&str> = trimmed.split_whitespace().collect();
    let raw_uri = if parts.len() >= 2 { parts[1] } else { "/" };

    // 1. Direct /proxy/:port/*path prefix
    if raw_uri.starts_with("/proxy/") {
        let after_proxy = &raw_uri["/proxy/".len()..];
        let (port_str, rest_path) = match after_proxy.find('/') {
            Some(idx) => (&after_proxy[..idx], &after_proxy[idx..]),
            None => match after_proxy.find('?') {
                Some(q_idx) => (&after_proxy[..q_idx], &after_proxy[q_idx..]),
                None => (after_proxy, "/"),
            },
        };
        if let Ok(port) = port_str.parse::<u16>() {
            if port > 0 {
                let forward_path = if rest_path.is_empty() { "/" } else { rest_path };
                return (port, forward_path.to_string());
            }
        }
    }

    // 2. /api/preview?url=... or /preview?url=...
    if raw_uri.starts_with("/api/preview") || raw_uri.starts_with("/preview") {
        if let Some(query_idx) = raw_uri.find('?') {
            let query = &raw_uri[query_idx + 1..];
            for param in query.split('&') {
                if param.starts_with("url=") {
                    let encoded_val = &param[4..];
                    let decoded_val = urlencoding_decode(encoded_val);
                    if let Ok((_scheme, _host, port, path)) = parse_target_url(&decoded_val) {
                        return (port, path);
                    }
                }
            }
        }
    }

    // 3. Cookie header containing agentdeck_preview_port
    for (name, val) in headers {
        if name.eq_ignore_ascii_case("cookie") {
            for cookie in val.split(';') {
                let cookie_trim = cookie.trim();
                if cookie_trim.starts_with("agentdeck_preview_port=") {
                    let port_part = &cookie_trim["agentdeck_preview_port=".len()..];
                    if let Ok(port) = port_part.parse::<u16>() {
                        if port > 0 {
                            return (port, raw_uri.to_string());
                        }
                    }
                }
            }
        }
    }

    // 4. Referer header check (e.g. Referer: http://127.0.0.1:4020/proxy/5173/...)
    for (name, val) in headers {
        if name.eq_ignore_ascii_case("referer") {
            if let Some(pos) = val.find("/proxy/") {
                let sub = &val[pos + "/proxy/".len()..];
                let port_sub = sub.split(&['/', '?', '#'][..]).next().unwrap_or("");
                if let Ok(port) = port_sub.parse::<u16>() {
                    if port > 0 {
                        return (port, raw_uri.to_string());
                    }
                }
            }
        }
    }

    // 5. Fallback to last known preview port
    (get_last_preview_port(), raw_uri.to_string())
}

/// Forwards any client request (HTML, JS, CSS, images, JSON) to target dev server port
pub async fn forward_proxy_request(
    port: u16,
    method: &str,
    path_and_query: &str,
    client_headers: &[(String, String)],
    body_bytes: &[u8],
) -> Result<ProxyResponse, String> {
    set_last_preview_port(port);
    let addr = format!("127.0.0.1:{}", port);

    let clean_path = if path_and_query.is_empty() { "/" } else { path_and_query };

    let mut stream = match tokio::time::timeout(
        std::time::Duration::from_secs(5),
        TcpStream::connect(&addr),
    ).await {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => {
            return Err(format!("Could not connect to {}: {}", addr, e));
        }
        Err(_) => {
            return Err(format!("Connection timed out connecting to {}", addr));
        }
    };

    // Construct HTTP/1.1 request wire bytes
    // Strip Accept-Encoding so dev servers return plain uncompressed UTF-8 (not gzip/brotli)
    let mut req_wire = format!("{} {} HTTP/1.1\r\nHost: 127.0.0.1:{}\r\n", method, clean_path, port);
    for (name, val) in client_headers {
        let lower = name.to_lowercase();
        if lower != "host" && lower != "content-length" && lower != "connection" && lower != "accept-encoding" {
            req_wire.push_str(&format!("{}: {}\r\n", name, val));
        }
    }
    req_wire.push_str("Accept-Encoding: identity\r\n");
    req_wire.push_str(&format!("Content-Length: {}\r\n", body_bytes.len()));
    req_wire.push_str("Connection: close\r\n\r\n");

    if let Err(e) = stream.write_all(req_wire.as_bytes()).await {
        return Err(format!("Failed to write request headers to {}: {}", addr, e));
    }
    if !body_bytes.is_empty() {
        if let Err(e) = stream.write_all(body_bytes).await {
            return Err(format!("Failed to write request body to {}: {}", addr, e));
        }
    }

    let mut response_bytes = Vec::new();
    let mut buf = [0u8; 16384];
    loop {
        match stream.read(&mut buf).await {
            Ok(0) => break,
            Ok(n) => response_bytes.extend_from_slice(&buf[..n]),
            Err(e) => {
                log::warn!("Proxy stream read error: {}", e);
                break;
            }
        }
    }

    if response_bytes.is_empty() {
        return Err(format!("Empty response from {}", addr));
    }

    // Split headers and body
    let (header_bytes, raw_body_bytes) = if let Some(pos) = response_bytes.windows(4).position(|w| w == b"\r\n\r\n") {
        (&response_bytes[..pos], &response_bytes[pos + 4..])
    } else if let Some(pos) = response_bytes.windows(2).position(|w| w == b"\n\n") {
        (&response_bytes[..pos], &response_bytes[pos + 2..])
    } else {
        (&response_bytes[..], &[][..])
    };

    let header_str = String::from_utf8_lossy(header_bytes);
    let mut lines = header_str.lines();
    let first_line = lines.next().unwrap_or("HTTP/1.1 200 OK");
    let status_code = first_line.split_whitespace().nth(1).and_then(|s| s.parse::<u16>().ok()).unwrap_or(200);

    let mut content_type = "text/html; charset=utf-8".to_string();
    let mut is_chunked = false;
    let mut response_headers = Vec::new();

    for line in lines {
        if let Some(colon_pos) = line.find(':') {
            let key = line[..colon_pos].trim();
            let val = line[colon_pos + 1..].trim();
            let lower_key = key.to_lowercase();
            if lower_key == "content-type" {
                content_type = val.to_string();
            }
            if lower_key == "transfer-encoding" && val.to_lowercase().contains("chunked") {
                is_chunked = true;
            }
            // Strip restrictive frame headers, encoding, and duplicate content-type/length
            if lower_key != "x-frame-options"
                && lower_key != "content-security-policy"
                && lower_key != "transfer-encoding"
                && lower_key != "content-length"
                && lower_key != "content-encoding"
                && lower_key != "content-type"
            {
                response_headers.push((key.to_string(), val.to_string()));
            }
        }
    }

    let mut final_body = if is_chunked {
        decode_chunked_body(raw_body_bytes)
    } else {
        raw_body_bytes.to_vec()
    };

    // If HTML, inject inspector script and color-scheme without cross-origin base tag
    if content_type.contains("text/html") {
        let body_str = String::from_utf8_lossy(&final_body);
        let prepared = prepare_html_with_inspector(&body_str, "");
        final_body = prepared.into_bytes();
    }

    response_headers.push(("Access-Control-Allow-Origin".to_string(), "*".to_string()));
    response_headers.push(("Access-Control-Allow-Methods".to_string(), "GET, POST, PUT, DELETE, PATCH, OPTIONS".to_string()));
    response_headers.push(("Access-Control-Allow-Headers".to_string(), "*".to_string()));
    response_headers.push(("Set-Cookie".to_string(), format!("agentdeck_preview_port={}; Path=/; SameSite=Lax", port)));

    Ok(ProxyResponse {
        status_code,
        content_type,
        headers: response_headers,
        body: final_body,
    })
}


/// Standalone AgentDeck Inspector Script (raw JavaScript) injected into previewed HTML or native Webview
pub const AGENTDECK_INSPECTOR_JS: &str = r#"
(function() {
  if (window.__AGENTDECK_INSPECTOR_ACTIVE__) return;
  window.__AGENTDECK_INSPECTOR_ACTIVE__ = true;

  // 1. Path Virtualization for Dev Gateway
  // Prevents Next.js / Vite / SPA client routers from rendering 404
  try {
    const loc = window.location;
    const pathname = loc.pathname;
    if (pathname.startsWith('/proxy/')) {
      const afterProxy = pathname.slice(7);
      const slashIdx = afterProxy.indexOf('/');
      const virtualPath = slashIdx === -1 ? '/' : afterProxy.slice(slashIdx);
      const target = (virtualPath || '/') + loc.search + loc.hash;
      if (loc.pathname !== virtualPath) {
        window.history.replaceState(window.history.state, '', target);
      }
    } else if (pathname === '/api/preview' || pathname === '/preview') {
      const sp = new URLSearchParams(loc.search);
      const urlParam = sp.get('url');
      if (urlParam) {
        try {
          const parsed = new URL(urlParam);
          const virtualPath = (parsed.pathname || '/') + parsed.search + parsed.hash;
          window.history.replaceState(window.history.state, '', virtualPath);
        } catch {}
      }
    }
    // Remove cross-origin base tag to prevent replaceState DOMException
    const baseEl = document.querySelector('base');
    if (baseEl && baseEl.href && !baseEl.href.startsWith(loc.origin)) {
      baseEl.remove();
    }
  } catch (err) {}

  // 2. Prevent white background flash
  try {
    if (document.documentElement && !document.documentElement.style.backgroundColor) {
      document.documentElement.style.backgroundColor = '#0d1117';
    }
  } catch (err) {}

  let isInspectEnabled = false;
  let hoveredElement = null;

  // 3. Highlight Overlay and Badge
  const overlay = document.createElement('div');
  overlay.id = '__agentdeck_overlay';
  overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #3b82f6;background-color:rgba(59,130,246,0.12);transition:all 60ms ease-out;display:none;box-sizing:border-box;';

  const badge = document.createElement('div');
  badge.id = '__agentdeck_badge';
  badge.style.cssText = 'position:absolute;top:-26px;left:0;background-color:#1e293b;color:#f8fafc;font-family:monospace;font-size:11px;padding:2px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 2px 4px rgba(0,0,0,0.2);pointer-events:none;';
  overlay.appendChild(badge);

  function ensureOverlayMounted() {
    if (!document.getElementById('__agentdeck_overlay')) {
      (document.body || document.documentElement).appendChild(overlay);
    }
  }
  if (document.body || document.documentElement) {
    ensureOverlayMounted();
  } else {
    window.addEventListener('DOMContentLoaded', ensureOverlayMounted);
  }

  function getElementSourceMeta(el) {
    let componentName = el.tagName.toLowerCase();
    let filePath = null;
    let lineNumber = null;

    try {
      const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
      if (fiberKey) {
        let fiber = el[fiberKey];
        while (fiber) {
          if (fiber._debugSource) {
            filePath = fiber._debugSource.fileName;
            lineNumber = fiber._debugSource.lineNumber;
          }
          if (fiber.type && typeof fiber.type === 'function') {
            componentName = fiber.type.displayName || fiber.type.name || componentName;
            break;
          }
          fiber = fiber.return;
        }
      }
    } catch {}

    try {
      if (el.__svelte_meta && el.__svelte_meta.loc) {
        filePath = el.__svelte_meta.loc.file;
        lineNumber = el.__svelte_meta.loc.line;
      }
    } catch {}

    try {
      if (el.__vnode) {
        const comp = el.__vnode.type;
        if (comp && typeof comp === 'object') {
          componentName = comp.name || comp.__name || componentName;
          filePath = comp.__file || filePath;
        }
      }
    } catch {}

    if (el.dataset && el.dataset.sourceLoc) {
      const parts = el.dataset.sourceLoc.split(':');
      filePath = parts[0];
      if (parts[1]) lineNumber = parseInt(parts[1], 10);
    }
    if (el.dataset && el.dataset.component) {
      componentName = el.dataset.component;
    }

    return { componentName, filePath, lineNumber };
  }

  function getElementSelector(el) {
    if (el.id) return '#' + el.id;
    const parts = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 3) {
      let selector = current.tagName.toLowerCase();
      if (current.className && typeof current.className === 'string') {
        const firstClass = current.className.trim().split(/\s+/)[0];
        if (firstClass && !firstClass.startsWith('__')) {
          selector += '.' + firstClass;
        }
      }
      parts.unshift(selector);
      current = current.parentElement;
    }
    return parts.join(' > ');
  }

  function updateOverlay(el) {
    if (!el || el === overlay || el === badge || el.id === '__agentdeck_native_pill') {
      overlay.style.display = 'none';
      return;
    }
    const rect = el.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';

    const meta = getElementSourceMeta(el);
    const tagLabel = meta.componentName || el.tagName.toLowerCase();
    const fileLabel = meta.filePath ? ' (' + meta.filePath.split('/').pop() + (meta.lineNumber ? ':' + meta.lineNumber : '') + ')' : '';
    badge.textContent = '<' + tagLabel + '>' + fileLabel;

    if (rect.top < 30) {
      badge.style.top = '4px';
    } else {
      badge.style.top = '-26px';
    }
  }

  window.addEventListener('mousemove', function(e) {
    if (!isInspectEnabled) return;
    if (e.target && (e.target.id === '__agentdeck_steer_popup' || (e.target.closest && e.target.closest('#__agentdeck_steer_popup')))) {
      overlay.style.display = 'none';
      return;
    }
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || target === overlay || target === badge || target.id === '__agentdeck_native_pill') return;
    hoveredElement = target;
    updateOverlay(target);
  }, true);

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function closeNativeSteerPopup() {
    const existing = document.getElementById('__agentdeck_steer_popup');
    if (existing) {
      existing.remove();
    }
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  window.__AGENTDECK_CLOSE_STEER_POPUP__ = closeNativeSteerPopup;

  function notifySelectionCancelled() {
    try {
      window.parent.postMessage({ type: 'AGENTDECK_COMPONENT_CANCEL' }, '*');
    } catch {}
    try {
      if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
        window.__TAURI_INTERNALS__.invoke('report_inspected_component', { payload: null });
      } else if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
        window.__TAURI__.core.invoke('report_inspected_component', { payload: null });
      }
    } catch {}
  }

  function showNativeSteerPopup(meta) {
    if (!meta) return;
    const existing = document.getElementById('__agentdeck_steer_popup');
    if (existing) {
      existing.remove();
    }

    const popup = document.createElement('div');
    popup.id = '__agentdeck_steer_popup';
    popup.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483647;width:min(640px,calc(100vw - 32px));background:#0f172a;border:1px solid rgba(59,130,246,0.4);border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,0.65),0 0 0 1px rgba(59,130,246,0.2);padding:14px 16px;font-family:system-ui,-apple-system,sans-serif;color:#f8fafc;box-sizing:border-box;';

    const tag = meta.componentName || 'UI Element';
    const fileLoc = meta.filePath ? (meta.filePath.split('/').pop() + (meta.lineNumber ? ':' + meta.lineNumber : '')) : '';
    const selector = meta.selector || '';

    popup.innerHTML = [
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">',
        '<div style="display:flex;align-items:center;gap:6px;overflow:hidden;flex:1;">',
          '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);border-radius:6px;color:#60a5fa;font-family:monospace;font-size:12px;font-weight:600;white-space:nowrap;">',
            '&lt;' + escapeHtml(tag) + '&gt;',
          '</span>',
          fileLoc ? '<span style="padding:2px 7px;background:#1e293b;border-radius:6px;color:#94a3b8;font-family:monospace;font-size:11px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;max-width:180px;" title="' + escapeHtml(fileLoc) + '">' + escapeHtml(fileLoc) + '</span>' : '',
          selector ? '<span style="padding:2px 7px;background:#1e293b;border-radius:6px;color:#94a3b8;font-family:monospace;font-size:11px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;max-width:150px;" title="' + escapeHtml(selector) + '">' + escapeHtml(selector) + '</span>' : '',
        '</div>',
        '<button id="__agentdeck_popup_close" type="button" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;padding:4px;border-radius:4px;font-size:14px;line-height:1;" title="Dismiss (Esc)">✕</button>',
      '</div>',
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">',
        '<input id="__agentdeck_steer_input" type="text" placeholder="Describe what to change on &lt;' + escapeHtml(tag) + '&gt;..." style="flex:1;min-width:0;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:8px 12px;font-size:12px;color:#f8fafc;outline:none;box-sizing:border-box;" />',
        '<button id="__agentdeck_steer_submit" type="button" style="padding:8px 14px;background:#2563eb;color:#ffffff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:4px;transition:background 120ms;">',
          '<span>Steer to Agent</span>',
        '</button>',
      '</div>',
      '<div style="display:flex;align-items:center;justify-content:space-between;font-size:10px;color:#64748b;">',
        '<span>🎯 Steer target: <strong style="color:#93c5fd;">Active Terminal Agent</strong></span>',
        '<span>Press <strong style="color:#cbd5e1;font-family:monospace;">Enter</strong> to steer • <strong style="color:#cbd5e1;font-family:monospace;">Esc</strong> to cancel</span>',
      '</div>'
    ].join('');

    (document.body || document.documentElement).appendChild(popup);

    const input = document.getElementById('__agentdeck_steer_input');
    const submitBtn = document.getElementById('__agentdeck_steer_submit');
    const closeBtn = document.getElementById('__agentdeck_popup_close');

    function executeSteer() {
      const instruction = (input ? input.value : '').trim();
      if (!instruction) return;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Steering...';
        submitBtn.style.background = '#475569';
      }

      // 1. Post to parent iframe if embedded
      try {
        window.parent.postMessage({
          type: 'AGENTDECK_COMPONENT_STEER',
          payload: { meta: meta, instruction: instruction }
        }, '*');
      } catch {}

      // 2. HTTP POST to AgentDeck backend server (4020 and fallback 4022)
      try {
        fetch('http://127.0.0.1:4020/api/component-steer', {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meta: meta, instruction: instruction })
        }).catch(function() {
          fetch('http://127.0.0.1:4022/api/component-steer', {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ meta: meta, instruction: instruction })
          }).catch(function() {});
        });
      } catch {}

      // 3. Invoke Tauri backend if running in native OS webview
      try {
        if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
          window.__TAURI_INTERNALS__.invoke('steer_selected_component', { meta: meta, instruction: instruction });
        } else if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
          window.__TAURI__.core.invoke('steer_selected_component', { meta: meta, instruction: instruction });
        }
      } catch {}

      if (submitBtn) {
        submitBtn.style.background = '#10b981';
        submitBtn.textContent = '✓ Steered to Agent!';
      }
      setTimeout(closeNativeSteerPopup, 1200);
    }

    if (input) {
      setTimeout(function() { input.focus(); }, 60);
      input.addEventListener('keydown', function(evt) {
        if (evt.key === 'Enter') {
          evt.preventDefault();
          executeSteer();
        } else if (evt.key === 'Escape') {
          evt.preventDefault();
          closeNativeSteerPopup();
          notifySelectionCancelled();
        }
      });
    }

    if (closeBtn) {
      closeBtn.onclick = function(evt) {
        evt.preventDefault();
        closeNativeSteerPopup();
        notifySelectionCancelled();
      };
    }

    if (submitBtn) {
      submitBtn.onclick = function(evt) {
        evt.preventDefault();
        executeSteer();
      };
    }
  }

  function dispatchComponentPicked(payload) {
    // 1. Post to parent iframe if embedded
    try {
      window.parent.postMessage(payload, '*');
    } catch {}

    // 2. Post to opener window if opened in a popup or separate browser tab
    try {
      if (window.opener && window.opener !== window) {
        window.opener.postMessage(payload, '*');
      }
    } catch {}

    // 3. HTTP POST to AgentDeck backend server (handles standalone native webviews & external browsers)
    try {
      const data = payload.payload || payload;
      fetch('http://127.0.0.1:4020/api/component-picked', {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(function() {
        fetch('http://127.0.0.1:4022/api/component-picked', {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).catch(function() {});
      });
    } catch {}

    // 4. Invoke Tauri backend if running in native OS webview with IPC
    try {
      if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
        window.__TAURI_INTERNALS__.invoke('report_inspected_component', { payload: payload.payload });
      } else if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
        window.__TAURI__.core.invoke('report_inspected_component', { payload: payload.payload });
      }
    } catch {}
  }

  window.addEventListener('click', function(e) {
    if (!isInspectEnabled) return;
    if (e.target && (e.target.id === '__agentdeck_native_pill' || (e.target.closest && e.target.closest('#__agentdeck_native_pill')))) return;
    if (e.target && (e.target.id === '__agentdeck_steer_popup' || (e.target.closest && e.target.closest('#__agentdeck_steer_popup')))) return;

    e.preventDefault();
    e.stopPropagation();

    const target = hoveredElement || document.elementFromPoint(e.clientX, e.clientY);
    if (!target) return;

    const meta = getElementSourceMeta(target);
    const selector = getElementSelector(target);

    const payload = {
      type: 'AGENTDECK_COMPONENT_PICKED',
      payload: {
        componentName: meta.componentName,
        filePath: meta.filePath,
        lineNumber: meta.lineNumber,
        selector: selector,
        htmlSnippet: target.outerHTML ? target.outerHTML.slice(0, 1000) : '',
        textContent: target.innerText ? target.innerText.slice(0, 150) : '',
        classes: typeof target.className === 'string' ? target.className : '',
        pageUrl: window.location.href
      }
    };

    setInspectState(false);
    dispatchComponentPicked(payload);
    showNativeSteerPopup(payload.payload);
  }, true);

  function setInspectState(enabled) {
    isInspectEnabled = !!enabled;
    if (!isInspectEnabled) {
      overlay.style.display = 'none';
      hoveredElement = null;
    } else {
      closeNativeSteerPopup();
    }
    const pill = document.getElementById('__agentdeck_native_pill');
    if (pill) {
      pill.textContent = isInspectEnabled ? '🎯 Inspecting UI...' : '🎯 Inspect UI';
      pill.style.background = isInspectEnabled ? '#2563eb' : '#1e293b';
      pill.style.color = '#ffffff';
      pill.style.boxShadow = isInspectEnabled ? '0 0 12px rgba(37,99,235,0.6)' : '0 4px 14px rgba(0,0,0,0.35)';
    }
  }

  window.__AGENTDECK_SET_INSPECT__ = setInspectState;

  // 4. Floating Native Inspection Pill (only when running in top-level window)
  if (window.parent === window) {
    function initNativePill() {
      if (document.getElementById('__agentdeck_native_pill')) return;
      const pill = document.createElement('button');
      pill.id = '__agentdeck_native_pill';
      pill.type = 'button';
      pill.textContent = '🎯 Inspect UI';
      pill.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483646;padding:8px 14px;border-radius:20px;font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.35);transition:all 150ms ease;border:1px solid rgba(255,255,255,0.2);outline:none;user-select:none;background:#1e293b;color:#f1f5f9;';
      pill.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        setInspectState(!isInspectEnabled);
      };
      (document.body || document.documentElement).appendChild(pill);
    }
    if (document.body) {
      initNativePill();
    } else {
      window.addEventListener('DOMContentLoaded', initNativePill);
    }
  }

  window.addEventListener('message', function(e) {
    if (!e.data) return;
    if (e.data.type === 'AGENTDECK_SET_INSPECT') {
      setInspectState(e.data.enabled);
    } else if (e.data.type === 'AGENTDECK_CLOSE_STEER') {
      closeNativeSteerPopup();
    } else if (e.data.type === 'AGENTDECK_SET_THEME') {
      const scheme = e.data.colorScheme || 'dark';
      try {
        document.documentElement.style.colorScheme = scheme;
        if (scheme === 'dark') {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.classList.add('light');
        }
      } catch {}
    } else if (e.data.type === 'AGENTDECK_PING') {
      try {
        window.parent.postMessage({ type: 'AGENTDECK_INSPECTOR_READY', url: window.location.href }, '*');
      } catch {}
    }
  });

  window.addEventListener('click', function(e) {
    if (isInspectEnabled) return;
    const link = e.target && e.target.closest ? e.target.closest('a') : null;
    if (link && link.href && !link.target && !link.href.startsWith('javascript:')) {
      try {
        window.parent.postMessage({ type: 'AGENTDECK_NAVIGATE', url: link.href }, '*');
      } catch {}
    }
  }, true);

  try {
    window.parent.postMessage({ type: 'AGENTDECK_INSPECTOR_READY', url: window.location.href }, '*');
  } catch {}
})();
"#;

/// HTML snippet wrapping AGENTDECK_INSPECTOR_JS
pub const AGENTDECK_INSPECTOR_SNIPPET: &str = r#"<script id="__agentdeck_inspector_script">
(function() {
  if (typeof window !== 'undefined' && window.__AGENTDECK_INSPECTOR_ACTIVE__) return;
})();
</script>"#;

/// Injects base tag and inspector script into HTML
pub fn prepare_html_with_inspector(raw_html: &str, base_url: &str) -> String {
    let mut html = raw_html.to_string();

    // 1. Inject <base href="..."> only if base_url is non-empty and not present
    if !base_url.is_empty() && !html.contains("<base ") && !html.contains("<BASE ") {
        let clean_base = if !base_url.ends_with('/')
            && !base_url.split('/').last().unwrap_or("").contains('.')
        {
            format!("{}/", base_url)
        } else {
            base_url.to_string()
        };
        let base_tag = format!("<base href=\"{}\">\n  <meta name=\"color-scheme\" content=\"dark light\">\n", clean_base);
        if let Some(pos) = html.find("<head>") {
            html.insert_str(pos + 6, &format!("\n  {}", base_tag));
        } else if let Some(pos) = html.find("<HEAD>") {
            html.insert_str(pos + 6, &format!("\n  {}", base_tag));
        } else if let Some(pos) = html.find("<html>") {
            html.insert_str(pos + 6, &format!("\n<head>\n  {}</head>", base_tag));
        } else {
            html = format!("<head>\n  {}</head>\n{}", base_tag, html);
        }
    }

    // 2. Inject inspector script tag at the top of <head> so path virtualization runs before any app bundle
    if !html.contains("__agentdeck_inspector_script") {
        let script_tag = format!(
            "\n  <script id=\"__agentdeck_inspector_script\">\n{}\n  </script>",
            AGENTDECK_INSPECTOR_JS
        );
        if let Some(pos) = html.find("<head>") {
            html.insert_str(pos + 6, &script_tag);
        } else if let Some(pos) = html.find("<HEAD>") {
            html.insert_str(pos + 6, &script_tag);
        } else if let Some(pos) = html.rfind("</head>") {
            html.insert_str(pos, &script_tag);
        } else if let Some(pos) = html.rfind("</HEAD>") {
            html.insert_str(pos, &script_tag);
        } else if let Some(pos) = html.find("<html>") {
            html.insert_str(pos + 6, &format!("\n<head>{}</head>", script_tag));
        } else if let Some(pos) = html.find("<HTML>") {
            html.insert_str(pos + 6, &format!("\n<head>{}</head>", script_tag));
        } else {
            html = format!("<head>{}</head>\n{}", script_tag, html);
        }
    }

    html
}

/// Generates a friendly HTML error page when the target dev server is not reachable
pub fn render_dev_server_offline_html(target_url: &str) -> String {
    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Dev Server Offline - AgentDeck</title>
  <style>
    body {{
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      box-sizing: border-box;
      user-select: none;
    }}
    .card {{
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 32px 28px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 16px 36px rgba(0,0,0,0.5);
    }}
    .icon {{
      font-size: 36px;
      margin-bottom: 12px;
    }}
    h2 {{
      margin: 0 0 8px;
      font-size: 16px;
      color: #f0f6fc;
      font-weight: 600;
    }}
    p {{
      margin: 0 0 16px;
      font-size: 12px;
      color: #8b949e;
      line-height: 1.5;
    }}
    .url-badge {{
      display: inline-block;
      background: #21262d;
      border: 1px solid #30363d;
      color: #58a6ff;
      padding: 4px 10px;
      border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      margin-bottom: 20px;
      word-break: break-all;
    }}
    .actions {{
      display: flex;
      gap: 8px;
      justify-content: center;
    }}
    button {{
      background: #238636;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
    }}
    button:hover {{
      background: #2ea043;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔌</div>
    <h2>Dev Server Offline</h2>
    <p>Could not connect to the local server. Make sure your dev server (e.g. Vite, Next.js) is started.</p>
    <div class="url-badge">{}</div>
    <div class="actions">
      <button onclick="window.location.reload()">Retry Preview</button>
    </div>
  </div>
</body>
</html>"#,
        target_url
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_target_url_lower_bound() {
        // Port-only input defaults to http://127.0.0.1:<port>/
        let (scheme, host, port, path) = parse_target_url("5173").unwrap();
        assert_eq!(scheme, "http");
        assert_eq!(host, "127.0.0.1");
        assert_eq!(port, 5173);
        assert_eq!(path, "/");
    }

    #[test]
    fn test_parse_target_url_in_bound() {
        let (scheme, host, port, path) = parse_target_url("http://localhost:3000/app").unwrap();
        assert_eq!(scheme, "http");
        assert_eq!(host, "127.0.0.1");
        assert_eq!(port, 3000);
        assert_eq!(path, "/app");
    }

    #[test]
    fn test_parse_target_url_upper_bound() {
        let (scheme, host, port, path) = parse_target_url("https://example.com:8443/nested/path?param=1#hash").unwrap();
        assert_eq!(scheme, "https");
        assert_eq!(host, "example.com");
        assert_eq!(port, 8443);
        assert_eq!(path, "/nested/path?param=1#hash");
    }

    #[test]
    fn test_parse_http_raw_response_bounds() {
        // Lower: no headers
        let res_lower = parse_http_raw_response("Bare body text", "http://test").unwrap();
        assert!(res_lower.success);
        assert_eq!(res_lower.status_code, 200);
        assert_eq!(res_lower.body, "Bare body text");

        // In-bound: 200 OK with Content-Type
        let raw = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<h1>Hello</h1>";
        let res_in = parse_http_raw_response(raw, "http://test").unwrap();
        assert!(res_in.success);
        assert_eq!(res_in.status_code, 200);
        assert_eq!(res_in.content_type, "text/html; charset=utf-8");
        assert_eq!(res_in.body, "<h1>Hello</h1>");

        // Upper: 404 Not Found error
        let raw_404 = "HTTP/1.1 404 Not Found\r\ncontent-type: text/plain\r\n\r\nMissing";
        let res_upper = parse_http_raw_response(raw_404, "http://test").unwrap();
        assert!(!res_upper.success);
        assert_eq!(res_upper.status_code, 404);
        assert_eq!(res_upper.error, Some("HTTP Error 404".to_string()));
    }

    #[test]
    fn test_prepare_html_with_inspector_bounds() {
        // Lower: bare content
        let bare = "<div>Bare</div>";
        let out_bare = prepare_html_with_inspector(bare, "http://localhost:5173");
        assert!(out_bare.contains("<base href=\"http://localhost:5173/\">"));
        assert!(out_bare.contains("__agentdeck_inspector_script"));

        // In-bound: proper HTML with head
        let doc = "<!DOCTYPE html><html><head><title>App</title></head><body><h1>Hi</h1></body></html>";
        let out_doc = prepare_html_with_inspector(doc, "http://localhost:3000");
        assert!(out_doc.contains("<base href=\"http://localhost:3000/\">"));
        assert!(out_doc.contains("__agentdeck_inspector_script"));
        assert!(out_doc.contains("AGENTDECK_COMPONENT_PICKED"));

        // Upper: Idempotence (does not re-inject duplicate tags)
        let second_pass = prepare_html_with_inspector(&out_doc, "http://localhost:3000");
        assert_eq!(out_doc, second_pass);
    }

    #[test]
    fn test_render_dev_server_offline_html() {
        let page = render_dev_server_offline_html("http://localhost:5173");
        assert!(page.contains("Dev Server Offline"));
        assert!(page.contains("http://localhost:5173"));
        assert!(page.contains("window.location.reload()"));
    }

    #[test]
    fn test_resolve_request_target_port_bounds() {
        // Lower: empty or default falls back to last preview port (5173 default)
        set_last_preview_port(5173);
        let (port_low, path_low) = resolve_request_target_port("GET / HTTP/1.1", &[]);
        assert_eq!(port_low, 5173);
        assert_eq!(path_low, "/");

        // In-bound: explicit /proxy/:port/*path
        let (port_in, path_in) = resolve_request_target_port("GET /proxy/3000/src/main.tsx HTTP/1.1", &[]);
        assert_eq!(port_in, 3000);
        assert_eq!(path_in, "/src/main.tsx");

        // In-bound: /api/preview?url=...
        let (port_url, path_url) = resolve_request_target_port("GET /api/preview?url=http%3A%2F%2Flocalhost%3A8080%2Fdashboard HTTP/1.1", &[]);
        assert_eq!(port_url, 8080);
        assert_eq!(path_url, "/dashboard");

        // In-bound: Cookie header agentdeck_preview_port
        let headers_cookie = vec![("Cookie".to_string(), "session=abc; agentdeck_preview_port=4000; foo=bar".to_string())];
        let (port_cookie, path_cookie) = resolve_request_target_port("GET /@vite/client HTTP/1.1", &headers_cookie);
        assert_eq!(port_cookie, 4000);
        assert_eq!(path_cookie, "/@vite/client");

        // In-bound: Referer header
        let headers_ref = vec![("Referer".to_string(), "http://127.0.0.1:4020/proxy/5174/app".to_string())];
        let (port_ref, path_ref) = resolve_request_target_port("GET /assets/index.css HTTP/1.1", &headers_ref);
        assert_eq!(port_ref, 5174);
        assert_eq!(path_ref, "/assets/index.css");

        // Upper: high port and deep path with query
        let (port_up, path_up) = resolve_request_target_port("POST /proxy/65535/api/v1/data?page=2&sort=asc HTTP/1.1", &[]);
        assert_eq!(port_up, 65535);
        assert_eq!(path_up, "/api/v1/data?page=2&sort=asc");
    }

    #[test]
    fn test_decode_chunked_body_bounds() {
        // Lower: empty
        let empty = decode_chunked_body(b"");
        assert!(empty.is_empty());

        // In-bound: single chunk
        let single = b"5\r\nHello\r\n0\r\n\r\n";
        let out_single = decode_chunked_body(single);
        assert_eq!(out_single, b"Hello");

        // Upper: multi-chunk with extensions
        let multi = b"7;ext=1\r\nMozilla\r\n9\r\nDeveloper\r\n7\r\nNetwork\r\n0\r\n\r\n";
        let out_multi = decode_chunked_body(multi);
        assert_eq!(out_multi, b"MozillaDeveloperNetwork");
    }
}

