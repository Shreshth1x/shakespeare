import type {
  CompilePromptRequest,
  OptimizationMode,
  PromptContext,
  RouterDecision,
  RouterFailureMode,
  RouterMode,
  RouterPattern,
  RouterTarget
} from "./types.js";

export const SPEED_COMPILER_INSTRUCTIONS = [
  "You are Shakespeare, a latency-critical prompt compiler.",
  "Rewrite the rough request into the smallest prompt likely to succeed for the given mode and target.",
  "Preserve intent. Do not add unsupported facts, filenames, errors, preferences, or constraints.",
  "Use context only when clearly relevant. Treat context as observed, not guaranteed.",
  "Apply the provided pattern. Fill only missing pieces that materially improve success: goal, context, constraints, output shape, verification, or uncertainty handling.",
  "Speed rules: be concise, no examples unless provided, no preamble, no explanation, no markdown fence.",
  "Return only the rewritten prompt."
].join("\n");

export interface RouterPacket {
  m: RouterDecision["mode"];
  t: RouterDecision["target"];
  p: RouterDecision["pattern"];
  f: RouterDecision["failureMode"];
  r: string;
  c?: string;
}

export interface RoutedPrompt {
  decision: RouterDecision;
  packet: RouterPacket;
  packetText: string;
  fallback: string;
  contextUsed: string[];
  contextSourceCount: number;
  contextCharCount: number;
  routingLatencyMs: number;
}

interface ContextPiece {
  key: keyof PromptContext;
  label: string;
  value: string;
  maxChars: number;
}

const DEBUGGING_RE =
  /\b(debug|error|stack trace|exception|traceback|failing|failed|failure|fail|bug|crash|crashing|flaky|broken|root cause|timeout|doesn't work|does not work|not work)\b/i;
const CODING_RE = /\b(fix|implement|refactor|test|build|ship|pr|repo|code|component|route|api|database|schema|migration)\b/i;
const CODING_ACTION_RE = /\b(fix|implement|refactor|test|build|ship)\b/i;
const RESEARCH_RE = /\b(research|compare|best|latest|find|source|market|competitor|pricing|deep dive|investigate)\b/i;
const EXTRACTION_RE = /\b(extract|convert|parse|format as json|json|csv|schema|summarize into|format (this )?(as )?a? ?table|into a table)\b/i;
const REPLY_RE = /\b(reply|draft|email|message|respond|make this sound)\b/i;
const DECISION_RE = /\b(choose|decide|should i|recommend|pros and cons|tradeoff|trade-off)\b/i;
const CREATIVE_RE = /\b(brainstorm|tagline|ad|story|brand|name|concept|campaign)\b/i;
const CURRENT_FACT_RE = /\b(latest|current|today|pricing|price|legal|medical|financial|finance|market|competitor|best)\b/i;
const FORMAT_RE = /\b(format|json|table|csv|schema|bullets|list|markdown|output)\b/i;
const MULTI_STEP_RE = /\b(and then|also|after that|first|second|third|multiple|steps?|plan)\b/i;
const TONE_RE = /\b(tone|warm|concise|friendly|direct|professional|casual|audience)\b/i;
const DEICTIC_RE = /\b(this|it|that|these|those|here)\b/i;

export function buildRoutedPrompt(request: CompilePromptRequest): RoutedPrompt {
  const startedAt = Date.now();
  const decision = routePrompt(request);
  const context = buildCompactObservedContext(request.context, decision.contextBudgetChars, request.optimization_mode);
  const packet = buildRouterPacket(request, decision, context.text);
  const fallback = buildRouterFallback(request, decision, context.text);

  return {
    decision,
    packet,
    packetText: JSON.stringify(packet),
    fallback,
    contextUsed: context.sources,
    contextSourceCount: context.sources.length,
    contextCharCount: context.text.length,
    routingLatencyMs: Date.now() - startedAt
  };
}

export function routePrompt(request: CompilePromptRequest): RouterDecision {
  const target = detectRouterTarget(request.context);
  const mode = detectRouterMode(request, target);
  const pattern = selectPattern(mode);
  const failureMode = detectFailureMode(request, mode, target);
  const contextBudgetChars = contextBudgetFor(request.optimization_mode);
  const outputBudgetTokens = outputBudgetFor(request.optimization_mode, pattern);
  const reasoningEffort = reasoningEffortFor(request.optimization_mode);

  return {
    mode,
    target,
    failureMode,
    pattern,
    contextBudgetChars,
    outputBudgetTokens,
    reasoningEffort,
    needsModel: true
  };
}

export function detectRouterTarget(context: PromptContext | undefined): RouterTarget {
  const haystack = [
    context?.active_app,
    context?.window_title,
    context?.browser_hostname,
    context?.browser_title,
    context?.browser_url,
    context?.ide_editor,
    context?.ide_workspace,
    context?.ide_file_path
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!haystack) return "unknown";
  if (/\bclaude code\b/.test(haystack)) return "claude_code";
  if (/\bcodex\b/.test(haystack)) return "codex";
  if (/\bcursor\b/.test(haystack)) return "cursor";
  if (/chatgpt\.com|\bchatgpt\b/.test(haystack)) return "chatgpt";
  if (/claude\.ai|\bclaude\b/.test(haystack)) return "claude";
  if (/\bgmail\b|mail\.google\.com/.test(haystack)) return "gmail";
  if (/\bslack\b/.test(haystack)) return "slack";
  if (/\bnotion\b/.test(haystack)) return "notion";
  if (/\blinear\b/.test(haystack)) return "linear";
  if (/\bgithub\b|github\.com/.test(haystack)) return "github";
  return "unknown";
}

export function buildRouterPacket(request: CompilePromptRequest, decision: RouterDecision, compactContext = ""): RouterPacket {
  const packet: RouterPacket = {
    m: decision.mode,
    t: decision.target,
    p: decision.pattern,
    f: decision.failureMode,
    r: truncate(request.rough_prompt, 2000)
  };

  if (compactContext) {
    packet.c = compactContext;
  }

  return packet;
}

export function buildRouterFallback(request: CompilePromptRequest, decision: RouterDecision, compactContext = ""): string {
  if (request.mode === "custom" && request.custom_mode) {
    return joinLines([
      `Task: ${request.rough_prompt}`,
      compactContext ? `Observed context: ${compactContext}` : null,
      `Use the "${request.custom_mode.name}" mode: ${request.custom_mode.instructions}`,
      "Preserve the user's intent, avoid unsupported facts, keep the result concise, and return only the rewritten prompt."
    ]);
  }

  switch (decision.pattern) {
    case "agent_fix":
      return joinLines([
        `Goal: ${request.rough_prompt}`,
        compactContext ? `Use the observed context where relevant: ${compactContext}` : null,
        "Inspect the relevant files and current behavior first. Keep the change scoped, avoid unrelated edits, verify with the most relevant test or check, and summarize the result."
      ]);
    case "debug_root_cause":
      return joinLines([
        `Investigate: ${request.rough_prompt}`,
        compactContext ? `Observed failure/context: ${compactContext}` : null,
        "Reproduce or inspect the failure, identify the root cause, apply the narrowest fix if appropriate, and verify with the exact failing path or closest check."
      ]);
    case "research_compare":
      return joinLines([
        `Research: ${request.rough_prompt}`,
        compactContext ? `Observed context: ${compactContext}` : null,
        "Define the scope, use current primary sources for time-sensitive claims, compare the strongest options across clear dimensions, call out caveats and dates, and return a concise recommendation with sources."
      ]);
    case "extract_schema":
      return joinLines([
        `Transform this input: ${request.rough_prompt}`,
        compactContext ? `Observed input/context: ${compactContext}` : null,
        "Return the requested structured output only. Preserve source meaning, use null for missing fields, do not infer unsupported details, and keep the schema consistent."
      ]);
    case "reply_draft":
      return joinLines([
        `Draft the reply: ${request.rough_prompt}`,
        compactContext ? `Use this observed conversation context where relevant: ${compactContext}` : null,
        "Match the likely audience and tone, keep it concise, avoid inventing commitments, and return only the reply draft."
      ]);
    case "decision_matrix":
      return joinLines([
        `Decision: ${request.rough_prompt}`,
        compactContext ? `Observed context: ${compactContext}` : null,
        "Clarify the options and criteria, compare trade-offs, state assumptions, recommend the best path, and include when more information would change the answer."
      ]);
    case "creative_brief":
      return joinLines([
        `Creative brief: ${request.rough_prompt}`,
        compactContext ? `Observed context: ${compactContext}` : null,
        "State the objective, audience, style boundaries, number of options, and output format. Avoid generic filler and do not invent brand facts."
      ]);
    case "general_task":
    default:
      return joinLines([
        `Task: ${request.rough_prompt}`,
        compactContext ? `Use this observed context only where relevant: ${compactContext}` : null,
        "Make the request clear and actionable, preserve intent, add only useful constraints or output shape, and state assumptions when needed."
      ]);
  }
}

export function buildCompactObservedContext(
  context: PromptContext | undefined,
  budgetChars: number,
  optimizationMode: OptimizationMode
): { text: string; sources: string[] } {
  if (!context || budgetChars <= 0) {
    return { text: "", sources: [] };
  }

  const speed = optimizationMode === "speed";
  const pieces: ContextPiece[] = [
    piece("active_app", "App", context.active_app, 160),
    piece("window_title", "Window", context.window_title, 220),
    piece("detected_target", "Target", context.detected_target, 120),
    piece("browser_hostname", "Host", context.browser_hostname, 180),
    piece("browser_url", "URL", context.browser_url, 240),
    piece("browser_title", "Page", context.browser_title, 220),
    piece("browser_selection", "Browser selection", context.browser_selection, speed ? 500 : 1400),
    piece("browser_focused_text", "Browser input", context.browser_focused_text, speed ? 500 : 1400),
    piece("browser_visible_text", "Browser visible", context.browser_visible_text, speed ? 500 : 2200),
    piece("ide_editor", "IDE", context.ide_editor, 120),
    piece("ide_workspace", "Workspace", context.ide_workspace, 180),
    piece("ide_relative_file_path", "File", context.ide_relative_file_path, 300),
    piece("ide_language_id", "Language", context.ide_language_id, 120),
    piece("ide_selection", "Selected code", context.ide_selection, speed ? 500 : 1800),
    piece("ide_visible_text", "Visible code", context.ide_visible_text, speed ? 500 : 2200),
    piece("ide_diagnostics", "Diagnostics", context.ide_diagnostics, speed ? 500 : 1400),
    piece("ide_git_diff", "Git diff", context.ide_git_diff, speed ? 500 : 2600),
    piece("visible_text", "Screen text", context.visible_text, speed ? 500 : 2200),
    piece("clipboard_text", "Clipboard", context.clipboard_text, speed ? 400 : 1200)
  ].filter((candidate): candidate is ContextPiece => Boolean(candidate));

  const selected = context.selected_text?.trim();
  if (selected) {
    const selectedPiece = piece("selected_text", "Selection", selected, Math.min(500, selected.length));
    if (selectedPiece) {
      pieces.unshift(selectedPiece);
    }
  }

  const used: string[] = [];
  const rendered: string[] = [];
  let remaining = budgetChars;

  for (const contextPiece of pieces) {
    if (remaining <= 0) break;
    const labelPrefix = `${contextPiece.label}: `;
    const allowance = Math.min(contextPiece.maxChars, remaining - labelPrefix.length);
    if (allowance <= 24) continue;
    const value = truncate(contextPiece.value, allowance);
    const entry = `${labelPrefix}${value}`;
    rendered.push(entry);
    used.push(contextPiece.key);
    remaining -= entry.length + 2;
  }

  return {
    text: rendered.join("; "),
    sources: Array.from(new Set(used))
  };
}

export function isUsableRouterModelOutput(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 12) return false;
  if (/^```/.test(trimmed)) return false;
  if (/^\{[\s\S]*"optimized_prompt"/.test(trimmed)) return false;
  return true;
}

function detectRouterMode(request: CompilePromptRequest, target: RouterTarget): RouterMode {
  const text = routingHaystack(request);
  const codingTarget = target === "codex" || target === "claude_code" || target === "cursor";

  if (EXTRACTION_RE.test(text)) return "extraction";
  if (target === "gmail" || target === "slack" || REPLY_RE.test(text)) return "writing_reply";
  if ((codingTarget || request.mode === "coding_agent") && CODING_ACTION_RE.test(text)) return "coding_agent";
  if (DEBUGGING_RE.test(text)) return "debugging";
  if (RESEARCH_RE.test(text)) return "research";
  if (DECISION_RE.test(text)) return "decision_advice";
  if (CREATIVE_RE.test(text)) return "creative";
  if (request.mode !== "general" && request.mode !== "custom") return request.mode;
  if (codingTarget) return "coding_agent";
  if (CODING_RE.test(text)) return "coding_agent";
  return "general";
}

function detectFailureMode(request: CompilePromptRequest, mode: RouterMode, target: RouterTarget): RouterFailureMode {
  const text = routingHaystack(request);
  const rough = request.rough_prompt.trim();
  const hasContext = contextHasObservedText(request.context);

  if (CURRENT_FACT_RE.test(text)) return "hallucination_risk";
  if (DEICTIC_RE.test(rough) && hasContext) return "missing_context";
  if ((mode === "extraction" || EXTRACTION_RE.test(text)) && !FORMAT_RE.test(text)) return "parseability";
  if (mode === "writing_reply" && !TONE_RE.test(text)) return "tone_mismatch";
  if ((mode === "coding_agent" || target === "codex" || target === "claude_code" || target === "cursor") && rough.length < 120) {
    return "agent_overbuild";
  }
  if (mode === "coding_agent" && CODING_RE.test(text) && !/\b(scope|only|avoid|verify|test|done|acceptance)\b/i.test(text)) {
    return "wrong_scope";
  }
  if ((mode === "research" || mode === "decision_advice") && !FORMAT_RE.test(text)) return "wrong_output_shape";
  if (MULTI_STEP_RE.test(text) && !/\b(done|verify|acceptance|deliverable|final)\b/i.test(text)) return "agent_underbuild";
  if (rough.length > 260 || mode === "debugging" || mode === "research") return "needs_decomposition";
  if (rough.length < 80 || DEICTIC_RE.test(rough)) return "too_vague";
  return "wrong_output_shape";
}

function selectPattern(mode: RouterMode): RouterPattern {
  switch (mode) {
    case "coding_agent":
      return "agent_fix";
    case "debugging":
      return "debug_root_cause";
    case "research":
      return "research_compare";
    case "extraction":
      return "extract_schema";
    case "writing_reply":
      return "reply_draft";
    case "decision_advice":
      return "decision_matrix";
    case "creative":
      return "creative_brief";
    case "general":
    default:
      return "general_task";
  }
}

function routingHaystack(request: CompilePromptRequest): string {
  const context = request.context;
  return [
    request.rough_prompt,
    context?.active_app,
    context?.window_title,
    context?.detected_target,
    context?.browser_hostname,
    context?.browser_url,
    context?.browser_title,
    context?.browser_selection,
    context?.browser_focused_text,
    context?.ide_editor,
    context?.ide_workspace,
    context?.ide_relative_file_path,
    context?.ide_diagnostics
  ]
    .filter(Boolean)
    .join(" ");
}

function contextHasObservedText(context: PromptContext | undefined): boolean {
  if (!context) return false;
  return [
    context.browser_selection,
    context.browser_focused_text,
    context.browser_visible_text,
    context.visible_text,
    context.ide_selection,
    context.ide_visible_text,
    context.ide_diagnostics,
    context.ide_git_diff,
    context.clipboard_text
  ].some((value) => typeof value === "string" && value.trim().length > 0);
}

function contextBudgetFor(mode: OptimizationMode): number {
  if (mode === "speed") return 1200;
  if (mode === "quality") return 3000;
  return 4500;
}

function outputBudgetFor(mode: OptimizationMode, pattern: RouterPattern): number {
  if (mode === "speed") {
    return pattern === "research_compare" || pattern === "decision_matrix" ? 320 : 260;
  }
  if (mode === "quality") return 650;
  return 900;
}

function reasoningEffortFor(mode: OptimizationMode): RouterDecision["reasoningEffort"] {
  if (mode === "speed") return "none";
  if (mode === "quality") return "minimal";
  return "low";
}

function piece(key: keyof PromptContext, label: string, value: string | null | undefined, maxChars: number): ContextPiece | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return {
    key,
    label,
    value: trimmed,
    maxChars
  };
}

function joinLines(parts: Array<string | null>): string {
  return parts.filter(Boolean).join("\n");
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  if (maxLength <= 3) return value.slice(0, maxLength);
  return `${value.slice(0, maxLength - 3)}...`;
}
