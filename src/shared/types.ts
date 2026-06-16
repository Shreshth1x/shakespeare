export type BuiltInPromptMode = "general" | "coding_agent" | "debugging" | "research";

export type PromptMode = BuiltInPromptMode | "custom";

export type OptimizationMode = "speed" | "quality" | "max_quality";

export interface PromptContext {
  active_app?: string | null;
  window_title?: string | null;
  selected_text?: string | null;
  clipboard_text?: string | null;
  visible_text?: string | null;
  detected_target?: string | null;
  browser_url?: string | null;
  browser_title?: string | null;
  browser_hostname?: string | null;
  browser_selection?: string | null;
  browser_focused_text?: string | null;
  browser_visible_text?: string | null;
  ide_editor?: string | null;
  ide_workspace?: string | null;
  ide_file_path?: string | null;
  ide_relative_file_path?: string | null;
  ide_language_id?: string | null;
  ide_selection?: string | null;
  ide_visible_text?: string | null;
  ide_diagnostics?: string | null;
  ide_git_diff?: string | null;
}

export interface CompilePromptRequest {
  rough_prompt: string;
  mode: PromptMode;
  optimization_mode: OptimizationMode;
  context?: PromptContext;
  custom_mode?: CustomPromptModeInput;
}

export interface CompilePromptResponse {
  optimized_prompt: string;
  context_used: string[];
  warnings: string[];
  model?: string;
  latency_ms?: number;
}

export interface UsageStats {
  promptsEnhanced: number;
  acceptedRewrites: number;
  failedRewrites: number;
  totalLatencyMs: number;
  estimatedTimeSavedMs: number;
  regeneratedPreviews: number;
  canceledPreviews: number;
}

export interface AppSettings {
  hotkey: string;
  previewHotkey: string;
  backendUrl: string;
  clientToken: string;
  promptMode: PromptMode;
  activeCustomModeId: string | null;
  customModes: CustomPromptMode[];
  optimizationMode: OptimizationMode;
  restoreClipboard: boolean;
  previewEnabled: boolean;
  clipboardContextEnabled: boolean;
  screenContextEnabled: boolean;
  browserContextEnabled: boolean;
  ideContextEnabled: boolean;
  localHistoryEnabled: boolean;
  appDenylist: string[];
  stats: UsageStats;
}

export interface CustomPromptMode {
  id: string;
  name: string;
  instructions: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomPromptModeInput {
  name: string;
  instructions: string;
}

export interface ContextReceipt {
  context_used: string[];
  warnings: string[];
  model?: string;
  latency_ms?: number;
}

export interface HistoryRecord {
  id: string;
  createdAt: string;
  mode: PromptMode;
  optimizationMode: OptimizationMode;
  roughPrompt: string;
  optimizedPrompt: string;
  contextReceipt: ContextReceipt;
}

export interface PendingPreview {
  id: string;
  roughPrompt: string;
  optimizedPrompt: string;
  mode: PromptMode;
  optimizationMode: OptimizationMode;
  context: PromptContext;
  contextReceipt: ContextReceipt;
}

export interface BrowserContextSnapshot {
  url: string;
  title: string;
  hostname: string;
  selectedText: string;
  focusedText: string;
  visibleText: string;
  updatedAt: string;
  source: "browser_extension";
}

export interface ScreenContextSnapshot {
  text: string;
  sourceName: string;
  capturedAt: string;
  latencyMs: number;
  warning?: string;
}

export interface IdeContextSnapshot {
  editor: string;
  workspaceName: string;
  workspaceFolders: string[];
  filePath: string;
  relativeFilePath: string;
  languageId: string;
  selectedText: string;
  visibleText: string;
  diagnostics: string;
  gitDiff: string;
  updatedAt: string;
  source: "ide_extension";
}

export interface DashboardState {
  settings: AppSettings;
  backendHealthy: boolean;
  permissions: {
    accessibility: "granted" | "missing" | "unknown" | "not_required";
    screen: "granted" | "missing" | "unknown" | "disabled";
  };
  platform: NodeJS.Platform;
  registeredHotkey: boolean;
  registeredPreviewHotkey: boolean;
  pendingPreview: PendingPreview | null;
  history: HistoryRecord[];
  lastReceipt: ContextReceipt | null;
  browserContext: BrowserContextSnapshot | null;
  ideContext: IdeContextSnapshot | null;
  screenContext: ScreenContextSnapshot | null;
  screenContextBusy: boolean;
  browserBridge: {
    port: number;
    running: boolean;
  };
  ideBridge: {
    port: number;
    running: boolean;
  };
}
