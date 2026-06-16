export type PromptMode = "general" | "coding_agent" | "debugging" | "research";

export type OptimizationMode = "speed" | "quality" | "max_quality";

export interface PromptContext {
  active_app?: string | null;
  window_title?: string | null;
  selected_text?: string | null;
  clipboard_text?: string | null;
  visible_text?: string | null;
}

export interface CompilePromptRequest {
  rough_prompt: string;
  mode: PromptMode;
  optimization_mode: OptimizationMode;
  context?: PromptContext;
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
}

export interface AppSettings {
  hotkey: string;
  backendUrl: string;
  clientToken: string;
  promptMode: PromptMode;
  optimizationMode: OptimizationMode;
  restoreClipboard: boolean;
  stats: UsageStats;
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
}
