export type BuiltInPromptMode = "general" | "coding_agent" | "debugging" | "research";

export type PromptMode = BuiltInPromptMode | "custom";

export type OptimizationMode = "speed" | "quality" | "max_quality";

export type RouterMode =
  | "writing"
  | "practical_guidance"
  | "coding_agent"
  | "debugging"
  | "research"
  | "extraction"
  | "summarization_translation"
  | "learning_tutoring"
  | "marketing_sales"
  | "job_career"
  | "image_prompt"
  | "tool_reference"
  | "writing_reply"
  | "decision_advice"
  | "creative"
  | "general";

export type RouterTarget =
  | "codex"
  | "claude_code"
  | "cursor"
  | "chatgpt"
  | "claude"
  | "gmail"
  | "slack"
  | "notion"
  | "linear"
  | "github"
  | "unknown";

export type RouterFailureMode =
  | "too_vague"
  | "missing_context"
  | "wrong_scope"
  | "wrong_output_shape"
  | "hallucination_risk"
  | "agent_overbuild"
  | "agent_underbuild"
  | "missing_reference_workflow"
  | "ignored_tool"
  | "missing_evidence"
  | "missing_audience"
  | "missing_schema"
  | "missing_acceptance"
  | "missing_visual_verification"
  | "high_stakes_uncertainty"
  | "generic_advice"
  | "no_recommendation"
  | "missing_learning_loop"
  | "generic_copy"
  | "fabrication_risk"
  | "bland_options"
  | "vague_visual_direction"
  | "needs_decomposition"
  | "tone_mismatch"
  | "parseability";

export type RouterPattern =
  | "write_edit"
  | "practical_plan"
  | "agent_fix"
  | "ui_redesign"
  | "debug_root_cause"
  | "research_compare"
  | "extract_schema"
  | "summarize_translate"
  | "teach_practice"
  | "marketing_artifact"
  | "career_artifact"
  | "image_generation_prompt"
  | "tool_workflow"
  | "reply_draft"
  | "decision_matrix"
  | "creative_brief"
  | "general_task";

export type RouterArchetype =
  | "writing_editing"
  | "practical_guidance"
  | "research_info"
  | "decision_support"
  | "coding_implementation"
  | "debugging"
  | "extraction_transformation"
  | "summarization_translation"
  | "learning_tutoring"
  | "marketing_sales_seo"
  | "job_career"
  | "creative_brainstorming"
  | "image_visual_prompt"
  | "tool_reference_workflow"
  | "ui_redesign_reference";

export type RouterValuePrimitive =
  | "tool_binding"
  | "reference_extraction"
  | "evidence_contract"
  | "decision_contract"
  | "deliverable_contract"
  | "acceptance_contract"
  | "schema_contract"
  | "fidelity_contract"
  | "audience_tone_contract"
  | "learning_contract"
  | "reproduction_contract"
  | "visual_verification_contract"
  | "safety_uncertainty_contract"
  | "practical_plan_contract"
  | "marketing_contract"
  | "career_evidence_contract"
  | "creative_diversity_contract"
  | "image_visual_contract"
  | "generic_clarity_contract";

export interface RouterDecision {
  mode: RouterMode;
  archetype: RouterArchetype;
  valuePrimitive: RouterValuePrimitive;
  target: RouterTarget;
  failureMode: RouterFailureMode;
  pattern: RouterPattern;
  contextBudgetChars: number;
  outputBudgetTokens: number;
  reasoningEffort: "none" | "low" | "medium" | "high" | "xhigh";
  needsModel: boolean;
}

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
  route_mode?: RouterDecision["mode"];
  route_archetype?: RouterDecision["archetype"];
  route_value_primitive?: RouterDecision["valuePrimitive"];
  route_target?: RouterDecision["target"];
  route_pattern?: RouterDecision["pattern"];
  route_failure_mode?: RouterDecision["failureMode"];
  used_fallback?: boolean;
  timed_out?: boolean;
  routing_latency_ms?: number;
  backend_latency_ms?: number;
  context_source_count?: number;
  context_char_count?: number;
  output_char_count?: number;
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
  focusedFieldRewriteEnabled: boolean;
  clipboardContextEnabled: boolean;
  screenContextEnabled: boolean;
  browserContextEnabled: boolean;
  ideContextEnabled: boolean;
  localHistoryEnabled: boolean;
  appDenylist: string[];
  teamPolicy: TeamPolicy | null;
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

export type PrivacyControlKey =
  | "previewEnabled"
  | "focusedFieldRewriteEnabled"
  | "clipboardContextEnabled"
  | "screenContextEnabled"
  | "browserContextEnabled"
  | "ideContextEnabled"
  | "localHistoryEnabled"
  | "restoreClipboard";

export interface TeamPrivacyControl {
  value: boolean;
  locked: boolean;
}

export interface TeamPolicy {
  teamName: string;
  updatedAt: string;
  sharedModes: CustomPromptMode[];
  privacyControls: Partial<Record<PrivacyControlKey, TeamPrivacyControl>>;
  appDenylist: string[];
  lockAppDenylist: boolean;
}

export interface ContextReceipt {
  context_used: string[];
  warnings: string[];
  model?: string;
  latency_ms?: number;
  route_mode?: RouterDecision["mode"];
  route_archetype?: RouterDecision["archetype"];
  route_value_primitive?: RouterDecision["valuePrimitive"];
  route_target?: RouterDecision["target"];
  route_pattern?: RouterDecision["pattern"];
  route_failure_mode?: RouterDecision["failureMode"];
  used_fallback?: boolean;
  timed_out?: boolean;
  routing_latency_ms?: number;
  backend_latency_ms?: number;
  context_source_count?: number;
  context_char_count?: number;
  output_char_count?: number;
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
  focusedTextTruncated?: boolean;
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
