import type { RepoInfo, RepoDiffData, CommitResult, DirectoryListing, BranchInfo, StashInfo, AgentIntegrationInfo, PtyProcessInfo } from '$lib/types';

const SERVER_BASE = 'http://127.0.0.1:4020';
const WS_BASE = 'ws://127.0.0.1:4020';

// Check if running inside Tauri window
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// WebSocket registry for browser / server mode
const activeWebSockets: Record<string, WebSocket> = {};
const pendingWrites: Record<string, string[]> = {};
let eventsWebSocket: WebSocket | null = null;
const eventListeners: Record<string, ((payload: any) => void)[]> = {};

function getEventsWs(): WebSocket {
  if (!eventsWebSocket || eventsWebSocket.readyState === WebSocket.CLOSED || eventsWebSocket.readyState === WebSocket.CLOSING) {
    try {
      eventsWebSocket = new WebSocket(`${WS_BASE}/ws/events`);
      eventsWebSocket.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          if (raw.event && eventListeners[raw.event]) {
            const payload = raw.data !== undefined ? raw.data : raw;
            for (const listener of eventListeners[raw.event]) {
              listener(payload);
            }
          }
        } catch (e) {
          console.error('Error parsing WS event:', e);
        }
      };
      eventsWebSocket.onerror = (e) => {
        console.debug('Events WebSocket connection error (server may not be active yet):', e);
      };
    } catch (e) {
      console.debug('Failed to construct Events WebSocket:', e);
    }
  }
  return eventsWebSocket!;
}

// Safe invoke wrapper
async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    return tauriInvoke<T>(cmd, args);
  }

  // Communicate with local AgentDeck Core server
  const endpointMap: Record<string, { url: string; method: string }> = {
    get_default_working_dir: { url: `${SERVER_BASE}/api/default-dir`, method: 'GET' },
    list_directory_folders: { url: `${SERVER_BASE}/api/fs/list-dirs`, method: 'POST' },
    open_repository: { url: `${SERVER_BASE}/api/repo/open`, method: 'POST' },
    get_repository_diffs: { url: `${SERVER_BASE}/api/repo/diffs`, method: 'POST' },
    stage_file: { url: `${SERVER_BASE}/api/repo/stage-file`, method: 'POST' },
    unstage_file: { url: `${SERVER_BASE}/api/repo/unstage-file`, method: 'POST' },
    stage_files: { url: `${SERVER_BASE}/api/repo/stage-files`, method: 'POST' },
    unstage_files: { url: `${SERVER_BASE}/api/repo/unstage-files`, method: 'POST' },
    stage_all: { url: `${SERVER_BASE}/api/repo/stage-all`, method: 'POST' },
    unstage_all: { url: `${SERVER_BASE}/api/repo/unstage-all`, method: 'POST' },
    stage_hunk: { url: `${SERVER_BASE}/api/repo/stage-hunk`, method: 'POST' },
    unstage_hunk: { url: `${SERVER_BASE}/api/repo/unstage-hunk`, method: 'POST' },
    discard_hunk: { url: `${SERVER_BASE}/api/repo/discard-hunk`, method: 'POST' },
    discard_file: { url: `${SERVER_BASE}/api/repo/discard-file`, method: 'POST' },
    commit_staged: { url: `${SERVER_BASE}/api/repo/commit`, method: 'POST' },
    commit_amend: { url: `${SERVER_BASE}/api/repo/commit-amend`, method: 'POST' },
    list_branches: { url: `${SERVER_BASE}/api/repo/branches`, method: 'POST' },
    checkout_branch: { url: `${SERVER_BASE}/api/repo/checkout-branch`, method: 'POST' },
    create_branch: { url: `${SERVER_BASE}/api/repo/create-branch`, method: 'POST' },
    stash_save: { url: `${SERVER_BASE}/api/repo/stash-save`, method: 'POST' },
    stash_pop: { url: `${SERVER_BASE}/api/repo/stash-pop`, method: 'POST' },
    list_stashes: { url: `${SERVER_BASE}/api/repo/stashes`, method: 'POST' },
    pull_repository: { url: `${SERVER_BASE}/api/repo/pull`, method: 'POST' },
    push_repository: { url: `${SERVER_BASE}/api/repo/push`, method: 'POST' },
    unwatch_repository: { url: `${SERVER_BASE}/api/repo/unwatch`, method: 'POST' },
    spawn_pty: { url: `${SERVER_BASE}/api/pty/spawn`, method: 'POST' },
    write_pty: { url: `${SERVER_BASE}/api/pty/write`, method: 'POST' },
    resize_pty: { url: `${SERVER_BASE}/api/pty/resize`, method: 'POST' },
    kill_pty: { url: `${SERVER_BASE}/api/pty/kill`, method: 'POST' },
    get_pty_process_info: { url: `${SERVER_BASE}/api/pty/process-info`, method: 'POST' },
    create_directory: { url: `${SERVER_BASE}/api/fs/create-dir`, method: 'POST' },
    init_repository: { url: `${SERVER_BASE}/api/repo/init`, method: 'POST' },
    read_file_content: { url: `${SERVER_BASE}/api/fs/read-file`, method: 'POST' },
    show_desktop_notification: { url: `${SERVER_BASE}/api/notifications/desktop`, method: 'POST' },
    get_agent_integrations: { url: `${SERVER_BASE}/api/integrations`, method: 'GET' },
    install_agent_integration: { url: `${SERVER_BASE}/api/integrations/install`, method: 'POST' },
    uninstall_agent_integration: { url: `${SERVER_BASE}/api/integrations/uninstall`, method: 'POST' },
  };

  const target = endpointMap[cmd];
  if (target) {
    try {
      const response = await fetch(target.url, {
        method: target.method,
        headers: { 'Content-Type': 'application/json' },
        body: target.method === 'POST' ? JSON.stringify(args || {}) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 404) {
          throw new Error(`Endpoint '${target.url}' not found (404). Please restart the backend server ('npm run server:dev') to load the latest backend routes.`);
        }
        throw new Error(errorText || `Server returned ${response.status}`);
      }

      const json = await response.json();
      if (cmd === 'get_default_working_dir') {
        return json.path as T;
      }
      if (cmd === 'create_directory') {
        return (typeof json === 'object' && json !== null && 'path' in json ? json.path : json) as T;
      }
      return json as T;
    } catch (e: any) {
      if (e?.message && !e.message.includes('Failed to fetch')) {
        // Real server error (e.g. not a git repo, bad hunk index) -> rethrow!
        throw e;
      }
      console.warn(`[AgentDeck Bridge] Backend server offline for '${cmd}'. Please run 'npm run server:dev':`, e);
      throw new Error(`Cannot connect to AgentDeck server on ${SERVER_BASE}. Please ensure 'npm run server:dev' is running.`);
    }
  }

  throw new Error(`Unknown command: ${cmd}`);
}

// Safe event listener wrapper
export async function listenEvent<T>(eventName: string, handler: (payload: T) => void): Promise<() => void> {
  if (isTauri()) {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<T>(eventName, (event) => handler(event.payload));
    return unlisten;
  } else {
    if (!eventListeners[eventName]) {
      eventListeners[eventName] = [];
    }
    eventListeners[eventName].push(handler);
    getEventsWs();

    return () => {
      eventListeners[eventName] = eventListeners[eventName].filter((h) => h !== handler);
    };
  }
}

// Commands
export async function getDefaultWorkingDir(): Promise<string> {
  return invoke<string>('get_default_working_dir');
}

export async function listDirectoryFolders(path?: string): Promise<DirectoryListing> {
  return invoke<DirectoryListing>('list_directory_folders', { path });
}

export async function createDirectory(parentPath: string, name: string): Promise<string> {
  return invoke<string>('create_directory', { parent_path: parentPath, parentPath, name });
}

export async function initRepository(path: string): Promise<RepoInfo> {
  return invoke<RepoInfo>('init_repository', { path });
}

export async function readFileContent(path: string, relativePath: string): Promise<string> {
  return invoke<string>('read_file_content', { path, relative_path: relativePath, relativePath });
}

export async function openRepository(path: string): Promise<RepoInfo> {
  return invoke<RepoInfo>('open_repository', { path });
}

export async function unwatchRepository(path: string): Promise<void> {
  return invoke<void>('unwatch_repository', { path });
}

export async function getRepositoryDiffs(path: string): Promise<RepoDiffData> {
  return invoke<RepoDiffData>('get_repository_diffs', { path });
}

export async function stageFile(path: string, relativePath: string): Promise<void> {
  return invoke<void>('stage_file', { path, relative_path: relativePath, relativePath });
}

export async function unstageFile(path: string, relativePath: string): Promise<void> {
  return invoke<void>('unstage_file', { path, relative_path: relativePath, relativePath });
}

export async function stageFiles(path: string, relativePaths: string[]): Promise<void> {
  if (!relativePaths || relativePaths.length === 0) return;
  try {
    return await invoke<void>('stage_files', { path, relative_paths: relativePaths, relativePaths });
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg.includes('404') || msg.includes('Not Found') || msg.includes('Unknown command') || msg.includes('not found')) {
      for (const rel of relativePaths) {
        await stageFile(path, rel);
      }
      return;
    }
    throw e;
  }
}

export async function unstageFiles(path: string, relativePaths: string[]): Promise<void> {
  if (!relativePaths || relativePaths.length === 0) return;
  try {
    return await invoke<void>('unstage_files', { path, relative_paths: relativePaths, relativePaths });
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg.includes('404') || msg.includes('Not Found') || msg.includes('Unknown command') || msg.includes('not found')) {
      for (const rel of relativePaths) {
        await unstageFile(path, rel);
      }
      return;
    }
    throw e;
  }
}

export async function stageAll(path: string): Promise<void> {
  return invoke<void>('stage_all', { path });
}

export async function unstageAll(path: string): Promise<void> {
  return invoke<void>('unstage_all', { path });
}

export async function stageHunk(path: string, relativePath: string, hunkIndex: number): Promise<void> {
  return invoke<void>('stage_hunk', { path, relative_path: relativePath, hunk_index: hunkIndex, relativePath, hunkIndex });
}

export async function unstageHunk(path: string, relativePath: string, hunkIndex: number): Promise<void> {
  return invoke<void>('unstage_hunk', { path, relative_path: relativePath, hunk_index: hunkIndex, relativePath, hunkIndex });
}

export async function discardHunk(path: string, relativePath: string, hunkIndex: number): Promise<void> {
  return invoke<void>('discard_hunk', { path, relative_path: relativePath, hunk_index: hunkIndex, relativePath, hunkIndex });
}

export async function discardFile(path: string, relativePath: string): Promise<void> {
  return invoke<void>('discard_file', { path, relative_path: relativePath, relativePath });
}

export async function commitStaged(path: string, message: string): Promise<CommitResult> {
  return invoke<CommitResult>('commit_staged', { path, message });
}

export async function commitAmend(path: string, message: string): Promise<CommitResult> {
  return invoke<CommitResult>('commit_amend', { path, message });
}

export async function listBranches(path: string): Promise<BranchInfo[]> {
  return invoke<BranchInfo[]>('list_branches', { path });
}

export async function checkoutBranch(path: string, branchName: string): Promise<void> {
  return invoke<void>('checkout_branch', { path, branch_name: branchName, branchName });
}

export async function createBranch(path: string, branchName: string): Promise<void> {
  return invoke<void>('create_branch', { path, branch_name: branchName, branchName });
}

export async function stashSave(path: string, message?: string): Promise<void> {
  return invoke<void>('stash_save', { path, message });
}

export async function stashPop(path: string): Promise<void> {
  return invoke<void>('stash_pop', { path });
}

export async function listStashes(path: string): Promise<StashInfo[]> {
  return invoke<StashInfo[]>('list_stashes', { path });
}

export async function pullRepository(
  path: string,
  remote?: string,
  branch?: string
): Promise<string> {
  const res = await invoke<any>('pull_repository', { path, remote, branch });
  if (typeof res === 'string') return res;
  return res?.message || 'Pull successful';
}

export async function pushRepository(
  path: string,
  remote?: string,
  branch?: string,
  setUpstream?: boolean
): Promise<string> {
  const res = await invoke<any>('push_repository', {
    path,
    remote,
    branch,
    set_upstream: setUpstream,
    setUpstream,
  });
  if (typeof res === 'string') return res;
  return res?.message || 'Push successful';
}

export async function spawnPty(
  sessionId: string,
  cwd?: string,
  shell?: string,
  cols: number = 80,
  rows: number = 24
): Promise<string> {
  const res = await invoke<any>('spawn_pty', {
    session_id: sessionId,
    sessionId,
    cwd,
    shell,
    cols,
    rows,
  });

  if (!isTauri()) {
    // Close existing socket if any
    if (activeWebSockets[sessionId]) {
      activeWebSockets[sessionId].close();
      delete activeWebSockets[sessionId];
    }

    pendingWrites[sessionId] = [];

    // Open WebSocket streaming for PTY
    const socket = new WebSocket(`${WS_BASE}/ws/pty/${sessionId}`);
    socket.binaryType = 'arraybuffer';

    socket.onopen = () => {
      // Flush any pending buffered keystrokes
      const buffer = pendingWrites[sessionId] || [];
      while (buffer.length > 0) {
        const item = buffer.shift();
        if (item) socket.send(item);
      }
    };

    socket.onmessage = (event) => {
      let text = '';
      if (typeof event.data === 'string') {
        text = event.data;
      } else if (event.data instanceof ArrayBuffer) {
        text = new TextDecoder().decode(event.data);
      }
      
      if (eventListeners['pty-output']) {
        for (const listener of eventListeners['pty-output']) {
          listener({ session_id: sessionId, data: text });
        }
      }
    };

    socket.onerror = (err) => {
      console.error(`WebSocket error for session ${sessionId}:`, err);
    };

    activeWebSockets[sessionId] = socket;
  }

  return res?.session_id || sessionId;
}

export async function writePty(sessionId: string, data: string): Promise<void> {
  if (!isTauri()) {
    const ws = activeWebSockets[sessionId];
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
      return;
    } else if (ws && ws.readyState === WebSocket.CONNECTING) {
      if (!pendingWrites[sessionId]) pendingWrites[sessionId] = [];
      pendingWrites[sessionId].push(data);
      return;
    }
  }
  return invoke<void>('write_pty', { session_id: sessionId, sessionId, data });
}

export async function resizePty(sessionId: string, cols: number, rows: number): Promise<void> {
  return invoke<void>('resize_pty', { session_id: sessionId, sessionId, cols, rows });
}

export async function killPty(sessionId: string): Promise<void> {
  if (activeWebSockets[sessionId]) {
    activeWebSockets[sessionId].close();
    delete activeWebSockets[sessionId];
  }
  return invoke<void>('kill_pty', { session_id: sessionId, sessionId });
}

export async function getPtyProcessInfo(sessionId: string): Promise<PtyProcessInfo | null> {
  try {
    return await invoke<PtyProcessInfo>('get_pty_process_info', { session_id: sessionId, sessionId });
  } catch (e) {
    console.debug('[tauri.ts] getPtyProcessInfo error:', e);
    return null;
  }
}

export async function showDesktopNotification(title: string, body: string, urgency?: string): Promise<void> {
  return invoke<void>('show_desktop_notification', { title, body, urgency });
}

export async function focusAppWindow(): Promise<void> {
  if (isTauri()) {
    return invoke<void>('focus_app_window');
  } else if (typeof window !== 'undefined') {
    window.focus();
  }
}

export async function getAgentIntegrations(): Promise<AgentIntegrationInfo[]> {
  return invoke<AgentIntegrationInfo[]>('get_agent_integrations');
}

export async function installAgentIntegration(agent: string): Promise<AgentIntegrationInfo> {
  return invoke<AgentIntegrationInfo>('install_agent_integration', { agent });
}

export async function uninstallAgentIntegration(agent: string): Promise<AgentIntegrationInfo> {
  return invoke<AgentIntegrationInfo>('uninstall_agent_integration', { agent });
}

export interface PreviewPageResult {
  success: boolean;
  statusCode: number;
  contentType: string;
  body: string;
  finalUrl: string;
  error?: string;
}

export async function fetchPreviewPage(url: string): Promise<PreviewPageResult> {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    return tauriInvoke<PreviewPageResult>('fetch_preview_page', { url });
  }

  const res = await fetch(`${SERVER_BASE}/api/preview?url=${encodeURIComponent(url)}`);
  const text = await res.text();
  const contentType = res.headers.get('content-type') || 'text/html';
  return {
    success: res.ok,
    statusCode: res.status,
    contentType,
    body: text,
    finalUrl: url,
    error: res.ok ? undefined : `HTTP error ${res.status}`
  };
}

export async function openNativePreviewWindow(url: string): Promise<void> {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    await tauriInvoke('open_native_preview_window', { url });
  } else {
    window.open(url, '_blank', 'width=1200,height=800,resizable=yes');
  }
}

export async function closeNativePreviewWindow(): Promise<void> {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    await tauriInvoke('close_native_preview_window');
  }
}

export async function isNativePreviewOpen(): Promise<boolean> {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    return tauriInvoke<boolean>('is_native_preview_open');
  }
  return false;
}

export async function focusNativePreviewWindow(): Promise<void> {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    await tauriInvoke('focus_native_preview_window');
  }
}

export async function reloadNativePreviewWindow(): Promise<void> {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    await tauriInvoke('reload_native_preview_window');
  }
}

export async function setNativePreviewInspect(enabled: boolean): Promise<void> {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    await tauriInvoke('set_native_preview_inspect', { enabled });
  }
}

export async function closeNativeSteerPopup(): Promise<void> {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    await tauriInvoke('close_native_steer_popup');
  }
}

export async function steerSelectedComponent(meta: unknown, instruction: string): Promise<void> {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    await tauriInvoke('steer_selected_component', { meta, instruction });
  }
}
