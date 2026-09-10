export interface RepoInfo {
  path: string;
  name: string;
  branch: string;
  head_commit_sha?: string | null;
  head_commit_short?: string | null;
  head_commit_message?: string | null;
  staged_count: number;
  unstaged_count: number;
  untracked_count: number;
  is_dirty: boolean;
  ahead_count?: number;
  behind_count?: number;
}

export interface DiffToken {
  content: string;
  is_highlighted: boolean;
}

export interface DiffLine {
  line_type: 'add' | 'delete' | 'context' | 'header';
  content: string;
  old_lineno?: number | null;
  new_lineno?: number | null;
  tokens?: DiffToken[];
}

export interface DiffHunk {
  hunk_index: number;
  header: string;
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  is_staged: boolean;
  lines: DiffLine[];
}

export interface FileDiff {
  path: string;
  old_path?: string | null;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  is_staged: boolean;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface RepoDiffData {
  info: RepoInfo;
  files: FileDiff[];
}

export interface CommitResult {
  commit_sha: string;
  commit_short: string;
  message: string;
}

export interface BranchInfo {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  commit_short?: string | null;
}

export interface StashInfo {
  index: number;
  message: string;
  commit_short: string;
}

export interface SteerContext {
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
  isStaged: boolean;
}

export interface UIComponentContext {
  componentName?: string;
  filePath?: string;
  lineNumber?: number;
  selector: string;
  htmlSnippet: string;
  textContent?: string;
  classes?: string;
  pageUrl: string;
}

export type CanvasTab = 'diff' | 'preview';

export type AgentKind = 
  | 'antigravity' 
  | 'opencode' 
  | 'claude' 
  | 'aider' 
  | 'gemini' 
  | 'goose' 
  | 'custom' 
  | 'shell';

export type AgentEventType = 
  | 'input_required'
  | 'permission_required'
  | 'attention_required'
  | 'idle';

export interface AgentEvent {
  type: AgentEventType;
  agent: string;
  sessionId?: string;
  terminalId?: string;
  workspaceId?: string;
  cwd?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

export type AgentStatus = 'idle' | 'working' | 'blocked';

export interface PtyProcessInfo {
  session_id: string;
  pid?: number | null;
  binary_name?: string | null;
  cmdline?: string | null;
  is_agent: boolean;
  matched_agent?: string | null;
}

export interface PtySession {
  id: string;
  title: string;
  cwd: string;
  active: boolean;
  isAgent: boolean;
  agentKind: AgentKind;
  attentionState?: AgentEventType | null;
  attentionMessage?: string | null;
  agentStatus?: AgentStatus | null;
  detectedBinary?: string | null;
  isCustomTitle?: boolean;
}

export interface AgentIntegrationInfo {
  agent: string;
  name: string;
  detected: boolean;
  installed: boolean;
  configPath?: string;
  hookCommand?: string;
  description: string;
}

export type TerminalLayout = 'single' | 'split-horizontal' | 'split-vertical';

export interface ProjectItem {
  id: string;
  path: string;
  name: string;
  info: RepoInfo | null;
  files: FileDiff[];
  selectedFilePath: string | null;
  selectedIsStaged: boolean;
  fileFilter: 'all' | 'staged' | 'unstaged';
  fileExtensionFilter: string;
  searchQuery: string;
  sessions: PtySession[];
  activeSessionId: string;
  secondarySessionId?: string | null;
  focusedPane?: 'primary' | 'secondary';
  terminalLayout: TerminalLayout;
  terminalSplitPercent?: number;
  isRefreshing: boolean;
  isLoading: boolean;
}

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  template: string;
  isBuiltin?: boolean;
}

export interface FolderItem {
  name: string;
  path: string;
  is_git_repo: boolean;
}

export interface DirectoryListing {
  current_path: string;
  parent_path?: string | null;
  home_path: string;
  directories: FolderItem[];
}

export type ThemePreference = 'system' | 'black' | 'white' | 'dark' | 'light' | 'onedark' | 'dracula' | 'nord' | 'github-dark';
export type ResolvedTheme = 'dark' | 'light' | 'onedark' | 'dracula' | 'nord';

export interface TerminalSettings {
  shell: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontWeight: '300' | '400' | '500' | '600' | '700';
  fontWeightBold: '500' | '600' | '700' | '800' | '900';
  cursorStyle: 'bar' | 'block' | 'underline';
  cursorBlink: boolean;
  scrollback: number;
  fastScrollSensitivity: number;
  drawBoldTextInBrightColors: boolean;
  nerdFont: boolean;
}

