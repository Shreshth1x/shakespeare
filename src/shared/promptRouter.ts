import type {
  CompilePromptRequest,
  OptimizationMode,
  PromptContext,
  RouterArchetype,
  RouterDecision,
  RouterFailureMode,
  RouterMode,
  RouterPattern,
  RouterTarget,
  RouterValuePrimitive
} from "./types.js";

export const SPEED_COMPILER_INSTRUCTIONS = [
  "You are Shakespeare, a latency-critical prompt compiler.",
  "Rewrite the rough request into the smallest work contract likely to prevent the next wasted turn.",
  "Preserve intent. Do not add unsupported facts, filenames, sources, errors, credentials, preferences, or constraints.",
  "Use observed context only when clearly relevant. Treat context as observed, not guaranteed.",
  "Apply the packet's archetype and value primitive. Add that missing contract only: tool/source binding, evidence, schema, audience/tone, decision criteria, acceptance, reproduction, learning loop, visual verification, or uncertainty.",
  "Speed rules: concise, artifact-ready, no preamble, no explanation, no markdown fence.",
  "Return only the rewritten prompt."
].join("\n");

export interface RouterPacket {
  v: 2;
  target: RouterDecision["target"];
  archetype: RouterDecision["archetype"];
  value_primitive: RouterDecision["valuePrimitive"];
  mode: RouterDecision["mode"];
  pattern: RouterDecision["pattern"];
  failure_mode: RouterDecision["failureMode"];
  rough_prompt: string;
  context?: string;
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

interface ArchetypeRoute {
  archetype: RouterArchetype;
  mode: RouterMode;
  pattern: RouterPattern;
}

const DEBUGGING_RE =
  /\b(debug|diagnose|root cause|error|stack trace|exception|traceback|failing|failed|failure|fail|crash|crashing|flaky|broken|timeout|doesn't work|does not work|not work)\b/i;
const CODING_RE =
  /\b(fix|implement|refactor|test|build|ship|pr|repo|code|component|route|api|database|schema|migration|frontend|backend|renderer|electron|typescript|javascript)\b/i;
const CODING_ACTION_RE = /\b(fix|implement|refactor|test|build|ship|add|update|wire|integrate)\b/i;
const UI_SURFACE_RE = /\b(ui|ux|interface|screens?|dashboard|electron app|frontend|renderer|settings|onboarding|component|layout|design system)\b/i;
const UI_DESIGN_ACTION_RE =
  /\b(redesign|restyle|polish|visual design|typography|colors?|palette|spacing|clean|cleaner|look like|improve|benchmark|reference|inspiration|whisper flow|wispr flow|willow)\b/i;
const TOOL_REFERENCE_RE =
  /\b(mobbin|figma|mcp|browser|web search|search the web|github|notion|google drive|gmail|slack|linear|supabase|dataset|csv|screenshots?|docs?|documentation|api|reference|references|inspiration|benchmark|examples?)\b/i;
const EXPLICIT_TOOL_ACTION_RE =
  /\b(use|using|pull|fetch|search|inspect|look up|browse|query|read)\b[\s\S]{0,80}\b(mobbin|figma|mcp|browser|web search|github|notion|google drive|gmail|slack|linear|supabase|dataset|csv|screenshots?|docs?|documentation|api|reference|references)\b/i;
const RESEARCH_RE = /\b(research|compare|best|latest|find|source|market|competitor|pricing|deep dive|investigate|look up|evaluate tools?)\b/i;
const CURRENT_FACT_RE =
  /\b(latest|current|today|recent|now|202[5-9]|pricing|price|market|competitor|law|legal|medical|medicine|financial|finance|tax|regulation|requirements?)\b/i;
const HIGH_STAKES_RE =
  /\b(medical|doctor|diagnosis|symptom|medicine|medication|dose|legal|lawyer|lawsuit|contract|compliance|tax|financial advice|investment|insurance|loan|mortgage|immigration|safety|emergency)\b/i;
const EXTRACTION_RE =
  /\b(extract|convert|parse|format as json|json|csv|yaml|schema|summarize into|format (this )?(as )?a? ?table|into a table|action items?|checklist|fields?)\b/i;
const FORMAT_RE = /\b(format|json|table|csv|yaml|schema|bullets|list|markdown|output|array|fields?)\b/i;
const REPLY_RE = /\b(reply|respond|response|email response|slack reply|message back|follow[- ]?up)\b/i;
const WRITING_RE =
  /\b(rewrite|draft|write|edit|copyedit|make this sound|make it sound|professional|clearer|improve wording|polish|tighten|status update|investor update|slack update|copy|blog post|memo|email|message|paragraph|announcement|bullets)\b/i;
const DECISION_RE = /\b(choose|decide|pick|should i|should we|recommend|recommendation|pros and cons|tradeoff|trade-off|which option|which model|which .* should|a or b|best path)\b/i;
const PRACTICAL_RE = /\b(how do i|how should|make me a plan|plan|help me figure|help me build|help me organize|what should i do|next steps|guide|process|strategy|roadmap|setting up)\b/i;
const SUMMARY_RE = /\b(summarize|summary|tl;?dr|tldr|translate|translation|condense|main point|explain the main|recap)\b/i;
const LEARNING_RE = /\b(teach|explain|learn|study|quiz|practice|tutor|eli5|walk me through|mental model|understand)\b/i;
const MARKETING_RE =
  /\b(landing page|homepage copy|sales email|cold email|seo|social posts?|linkedin posts?|ad copy|ads?|campaign|funnel|cta|offer|brand voice|copywriting|product marketing|launch copy|product positioning|pricing page copy|app store copy|webinar invite|nurture email|launch tweet|one-pager)\b/i;
const CAREER_RE =
  /\b(resume|résumé|cover letter|linkedin|interview|job description|job post|target role|recruiter|career|STAR|behavioral|internship|tell me about yourself|career gap|portfolio project|networking message)\b/i;
const IMAGE_PROMPT_RE =
  /\b(image prompt|midjourney|stable diffusion|dall[- ]?e|image generation|generate an image|illustration prompt|visual prompt|prompt for [\s\S]{0,60}(image|illustration|icon|poster|workspace)|photorealistic prompt|vector-style illustration)\b/i;
const CREATIVE_RE = /\b(brainstorm|tagline|names?|ideas?|concepts?|story|premises|themes?|creative brief|slogan|naming|moodboard)\b/i;
const MULTI_STEP_RE = /\b(and then|also|after that|first|second|third|multiple|steps?|plan)\b/i;
const TONE_RE = /\b(tone|warm|concise|friendly|direct|professional|casual|audience|voice)\b/i;
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
  const text = routingHaystack(request);
  const route = selectArchetypeRoute(request, target, text);
  const safetyOverride = HIGH_STAKES_RE.test(text);
  const valuePrimitive = selectValuePrimitive(request, route, text, safetyOverride);
  const failureMode = detectFailureMode(request, route, valuePrimitive, target, text);
  const contextBudgetChars = contextBudgetFor(request.optimization_mode);
  const outputBudgetTokens = outputBudgetFor(request.optimization_mode, route.pattern, valuePrimitive);
  const reasoningEffort = reasoningEffortFor(request.optimization_mode);

  return {
    mode: route.mode,
    archetype: route.archetype,
    valuePrimitive,
    target,
    failureMode,
    pattern: route.pattern,
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
    v: 2,
    target: decision.target,
    archetype: decision.archetype,
    value_primitive: decision.valuePrimitive,
    mode: decision.mode,
    pattern: decision.pattern,
    failure_mode: decision.failureMode,
    rough_prompt: truncate(request.rough_prompt, 2000)
  };

  if (compactContext) {
    packet.context = compactContext;
  }

  return packet;
}

export function buildRouterFallback(request: CompilePromptRequest, decision: RouterDecision, compactContext = ""): string {
  if (request.mode === "custom" && request.custom_mode) {
    return joinLines([
      `Task: ${request.rough_prompt}`,
      compactContext ? `Observed context: ${compactContext}` : null,
      `Use the "${request.custom_mode.name}" mode: ${request.custom_mode.instructions}`,
      "Preserve intent, avoid unsupported facts, apply only the missing work contract, and return only the rewritten prompt."
    ]);
  }

  const safetyLine = safetyContractLine(decision.valuePrimitive);

  switch (decision.pattern) {
    case "ui_redesign":
      return joinLines([
        `Redesign task: ${request.rough_prompt}`,
        compactContext ? `Observed context: ${compactContext}` : null,
        buildReferenceWorkflowLine(request.rough_prompt),
        "Extract concrete visual decisions before editing: typography scale, spacing rhythm, color palette, component density, control styling, and empty/preview states.",
        "Then inspect the current Electron renderer/components/styles and implement a scoped redesign that preserves existing behavior.",
        "Deliverables: updated UI code/styles, short design-decision summary with references used, and tests plus screenshot or visual check.",
        safetyLine
      ]);
    case "tool_workflow":
      return joinLines([
        `Use ${detectReferenceToolName(request.rough_prompt) ?? "the named tool/source"} as the required source for: ${request.rough_prompt}`,
        compactContext ? `Observed context: ${compactContext}` : null,
        "First run or inspect the named tool/source. Extract the facts, examples, constraints, or decisions it provides before producing the deliverable.",
        "Tie the final answer or implementation directly to what the tool/source showed, and cite or summarize references when useful.",
        safetyLine
      ]);
    case "research_compare":
      return joinLines([
        `Research: ${request.rough_prompt}`,
        compactContext ? `Observed context: ${compactContext}` : null,
        "Define the scope, use current primary sources for volatile claims, compare across clear dimensions, separate evidence from interpretation, include dates and caveats, and end with a concise recommendation or summary.",
        safetyLine
      ]);
    case "decision_matrix":
      return joinLines([
        `Decision: ${request.rough_prompt}`,
        compactContext ? `Observed context: ${compactContext}` : null,
        "Clarify the options and decision criteria, weigh tradeoffs against the user's constraints, recommend one path, and state what new information would change the answer.",
        safetyLine
      ]);
    case "agent_fix":
      return joinLines([
        `Implement in the current repo: ${request.rough_prompt}`,
        compactContext ? `Use observed context where relevant: ${compactContext}` : null,
        "First inspect the existing product flow and nearby code. Define the smallest useful implementation slice and acceptance criteria, make the scoped change without unrelated refactors, verify with the closest tests/checks, and summarize changed files.",
        safetyLine
      ]);
    case "debug_root_cause":
      return joinLines([
        `Investigate the observed failure: ${request.rough_prompt}`,
        compactContext ? `Observed evidence: ${compactContext}` : null,
        "Use logs/context as evidence. Reproduce or inspect the failing path, identify root cause before editing, apply the narrowest fix if appropriate, and verify against the exact failure or closest check.",
        safetyLine
      ]);
    case "extract_schema":
      return joinLines([
        `Transform the input: ${request.rough_prompt}`,
        compactContext ? `Observed input/context: ${compactContext}` : null,
        "Return the requested structured output only. Use a stable schema, preserve source meaning, use null for missing fields, and do not infer unsupported details.",
        safetyLine
      ]);
    case "summarize_translate":
      return joinLines([
        `Summarize or translate: ${request.rough_prompt}`,
        compactContext ? `Source context: ${compactContext}` : null,
        "Preserve key facts, nuance, named entities, and uncertainty. Use the requested audience, length, or format when provided. Do not add outside information.",
        safetyLine
      ]);
    case "teach_practice":
      return joinLines([
        `Teach: ${request.rough_prompt}`,
        compactContext ? `Learner/context clues: ${compactContext}` : null,
        "Assume the learner is smart but new unless stated otherwise. Start with the mental model, use one concrete example, avoid unnecessary jargon, then give 2-3 practice questions and check likely misconceptions.",
        safetyLine
      ]);
    case "marketing_artifact":
      return joinLines([
        `Create the marketing artifact: ${request.rough_prompt}`,
        compactContext ? `Observed context: ${compactContext}` : null,
        "Specify audience, offer, channel, funnel stage, brand voice, and CTA. Do not invent metrics, testimonials, guarantees, customer names, or unsupported claims.",
        safetyLine
      ]);
    case "career_artifact":
      return joinLines([
        `Create the career artifact: ${request.rough_prompt}`,
        compactContext ? `User/job context: ${compactContext}` : null,
        "Tailor to the target role or company when provided. Use only the user's supplied experience as evidence, avoid fabricating credentials, and return the requested format.",
        safetyLine
      ]);
    case "creative_brief":
      return joinLines([
        `Generate ideas for: ${request.rough_prompt}`,
        compactContext ? `Context: ${compactContext}` : null,
        "Give a useful number of options, vary them across clear diversity axes, stay within the style constraints, include a one-line rationale, and mark the strongest options.",
        safetyLine
      ]);
    case "image_generation_prompt":
      return joinLines([
        `Create an image-generation prompt for: ${request.rough_prompt}`,
        compactContext ? `Visual/source context: ${compactContext}` : null,
        "Specify subject, composition, medium, style, color/light, key details, constraints, and any negative constraints. Avoid contradictory style instructions.",
        safetyLine
      ]);
    case "reply_draft":
      return joinLines([
        `Draft the reply: ${request.rough_prompt}`,
        compactContext ? `Conversation context: ${compactContext}` : null,
        "Infer the likely audience and channel, match the appropriate tone, keep it concise, do not invent commitments or facts, and return only the reply draft.",
        safetyLine
      ]);
    case "write_edit":
      return joinLines([
        `Write or edit: ${request.rough_prompt}`,
        compactContext ? `Source/context: ${compactContext}` : null,
        "Preserve the user's facts and intent. Make audience, channel, tone, desired action, length, and output format explicit where missing. Do not invent commitments or details.",
        safetyLine
      ]);
    case "practical_plan":
      return joinLines([
        `Create a practical plan for: ${request.rough_prompt}`,
        compactContext ? `Current situation/context: ${compactContext}` : null,
        "Use the user's constraints and resources. Prioritize the next 3-5 actions, call out risks or assumptions, include decision points, and end with the first concrete step.",
        safetyLine
      ]);
    case "general_task":
    default:
      return joinLines([
        `Task: ${request.rough_prompt}`,
        compactContext ? `Use this observed context only where relevant: ${compactContext}` : null,
        "Make the request clear and actionable. Preserve intent, add only the missing output shape or constraint that prevents ambiguity, and state assumptions when needed.",
        safetyLine
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

function selectArchetypeRoute(request: CompilePromptRequest, target: RouterTarget, text: string): ArchetypeRoute {
  const codingTarget = target === "codex" || target === "claude_code" || target === "cursor";
  const roughPrompt = request.rough_prompt;

  if (HIGH_STAKES_RE.test(text)) {
    if ((RESEARCH_RE.test(text) || CURRENT_FACT_RE.test(text)) && !/\b(should|whether|can i|do i|stop taking|take this)\b/i.test(text)) {
      return route("research_info");
    }
    return route("practical_guidance");
  }

  if (isUiRedesignRequest(text)) return route("ui_redesign_reference");
  if (hasExplicitToolIntent(text)) return route("tool_reference_workflow");
  if (
    isDebuggingIntent(text) &&
    !(codingTarget && /^fix\b/i.test(request.rough_prompt) && !/\b(failing|failed|root cause|debug|investigate|crash|broken|timeout)\b/i.test(text))
  ) {
    return route("debugging");
  }
  if (IMAGE_PROMPT_RE.test(text)) return route("image_visual_prompt");
  if (isVolatileFactRequest(text)) return route("research_info");
  if (isPracticalPlanIntent(text)) return route("practical_guidance");
  if (EXTRACTION_RE.test(text)) return route("extraction_transformation");
  if (SUMMARY_RE.test(text) && !CAREER_RE.test(text)) return route("summarization_translation");
  if (isLearningIntent(text)) return route("learning_tutoring");
  if (DECISION_RE.test(text)) return route("decision_support");
  if (isCreativeIdeaIntent(roughPrompt)) return route("creative_brainstorming");
  if (MARKETING_RE.test(text)) return route("marketing_sales_seo");
  if (CAREER_RE.test(text)) return route("job_career");
  if (SUMMARY_RE.test(text)) return route("summarization_translation");
  if (RESEARCH_RE.test(text) && !DECISION_RE.test(text)) return route("research_info");
  if ((codingTarget || request.mode === "coding_agent") && CODING_ACTION_RE.test(text)) return route("coding_implementation");
  if (isDebuggingIntent(text)) return route("debugging");
  if (target === "gmail" || target === "slack" || isReplyDraftIntent(roughPrompt, text)) return route("writing_editing", "reply_draft");
  if (WRITING_RE.test(text)) return route("writing_editing");
  if (PRACTICAL_RE.test(text)) return route("practical_guidance");
  if (codingTarget || CODING_RE.test(text)) return route("coding_implementation");
  if (CREATIVE_RE.test(roughPrompt)) return route("creative_brainstorming");

  if (request.mode === "debugging") return route("debugging");
  if (request.mode === "research") return route("research_info");
  if (request.mode === "coding_agent") return route("coding_implementation");
  return route("practical_guidance");
}

function route(archetype: RouterArchetype, patternOverride?: RouterPattern): ArchetypeRoute {
  switch (archetype) {
    case "writing_editing":
      return { archetype, mode: patternOverride === "reply_draft" ? "writing_reply" : "writing", pattern: patternOverride ?? "write_edit" };
    case "practical_guidance":
      return { archetype, mode: "practical_guidance", pattern: "practical_plan" };
    case "research_info":
      return { archetype, mode: "research", pattern: "research_compare" };
    case "decision_support":
      return { archetype, mode: "decision_advice", pattern: "decision_matrix" };
    case "coding_implementation":
      return { archetype, mode: "coding_agent", pattern: "agent_fix" };
    case "debugging":
      return { archetype, mode: "debugging", pattern: "debug_root_cause" };
    case "extraction_transformation":
      return { archetype, mode: "extraction", pattern: "extract_schema" };
    case "summarization_translation":
      return { archetype, mode: "summarization_translation", pattern: "summarize_translate" };
    case "learning_tutoring":
      return { archetype, mode: "learning_tutoring", pattern: "teach_practice" };
    case "marketing_sales_seo":
      return { archetype, mode: "marketing_sales", pattern: "marketing_artifact" };
    case "job_career":
      return { archetype, mode: "job_career", pattern: "career_artifact" };
    case "creative_brainstorming":
      return { archetype, mode: "creative", pattern: "creative_brief" };
    case "image_visual_prompt":
      return { archetype, mode: "image_prompt", pattern: "image_generation_prompt" };
    case "tool_reference_workflow":
      return { archetype, mode: "tool_reference", pattern: "tool_workflow" };
    case "ui_redesign_reference":
      return { archetype, mode: "coding_agent", pattern: "ui_redesign" };
  }
}

function selectValuePrimitive(
  request: CompilePromptRequest,
  routeChoice: ArchetypeRoute,
  text: string,
  safetyOverride: boolean
): RouterValuePrimitive {
  if (safetyOverride) return "safety_uncertainty_contract";
  if (routeChoice.archetype === "ui_redesign_reference") {
    return "reference_extraction";
  }
  if (routeChoice.archetype === "tool_reference_workflow") return "tool_binding";
  if (isVolatileFactRequest(text) && routeChoice.archetype === "research_info") return "evidence_contract";

  switch (routeChoice.archetype) {
    case "writing_editing":
      return "audience_tone_contract";
    case "practical_guidance":
      return "practical_plan_contract";
    case "research_info":
      return "evidence_contract";
    case "decision_support":
      return "decision_contract";
    case "coding_implementation":
      return request.rough_prompt.length < 120 ? "acceptance_contract" : "deliverable_contract";
    case "debugging":
      return "reproduction_contract";
    case "extraction_transformation":
      return "schema_contract";
    case "summarization_translation":
      return "fidelity_contract";
    case "learning_tutoring":
      return "learning_contract";
    case "marketing_sales_seo":
      return "marketing_contract";
    case "job_career":
      return "career_evidence_contract";
    case "creative_brainstorming":
      return "creative_diversity_contract";
    case "image_visual_prompt":
      return "image_visual_contract";
  }
}

function detectFailureMode(
  request: CompilePromptRequest,
  routeChoice: ArchetypeRoute,
  primitive: RouterValuePrimitive,
  target: RouterTarget,
  text: string
): RouterFailureMode {
  const rough = request.rough_prompt.trim();
  const hasContext = contextHasObservedText(request.context);

  if (primitive === "safety_uncertainty_contract") return "high_stakes_uncertainty";
  if (routeChoice.archetype === "ui_redesign_reference" && TOOL_REFERENCE_RE.test(text)) return "missing_reference_workflow";
  if (routeChoice.archetype === "ui_redesign_reference") return "missing_visual_verification";
  if (primitive === "tool_binding") return "ignored_tool";
  if (primitive === "evidence_contract" && isVolatileFactRequest(text)) return "hallucination_risk";
  if (primitive === "evidence_contract") return "missing_evidence";
  if (DEICTIC_RE.test(rough) && hasContext) return "missing_context";
  if (primitive === "schema_contract" || ((routeChoice.mode === "extraction" || EXTRACTION_RE.test(text)) && !FORMAT_RE.test(text))) return "parseability";
  if (primitive === "audience_tone_contract") return TONE_RE.test(text) ? "wrong_output_shape" : "tone_mismatch";
  if (primitive === "decision_contract") return "no_recommendation";
  if (primitive === "learning_contract") return "missing_learning_loop";
  if (primitive === "marketing_contract") return "generic_copy";
  if (primitive === "career_evidence_contract") return "fabrication_risk";
  if (primitive === "creative_diversity_contract") return "bland_options";
  if (primitive === "image_visual_contract") return "vague_visual_direction";
  if ((routeChoice.mode === "coding_agent" || target === "codex" || target === "claude_code" || target === "cursor") && rough.length < 120) {
    return "agent_overbuild";
  }
  if (routeChoice.mode === "coding_agent" && CODING_RE.test(text) && !/\b(scope|only|avoid|verify|test|done|acceptance)\b/i.test(text)) {
    return "missing_acceptance";
  }
  if (MULTI_STEP_RE.test(text) && !/\b(done|verify|acceptance|deliverable|final)\b/i.test(text)) return "agent_underbuild";
  if (rough.length > 260 || routeChoice.mode === "debugging" || routeChoice.mode === "research") return "needs_decomposition";
  if (rough.length < 80 || DEICTIC_RE.test(rough)) return "too_vague";
  return "wrong_output_shape";
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
    context?.browser_visible_text,
    context?.visible_text,
    context?.clipboard_text,
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

function hasExplicitToolIntent(text: string): boolean {
  return EXPLICIT_TOOL_ACTION_RE.test(text) || /\b(mobbin|figma|mcp)\b/i.test(text);
}

function isExtractionDominant(text: string): boolean {
  return /\b(extract|convert|parse|transform)\b/i.test(text);
}

function isVolatileFactRequest(text: string): boolean {
  if (/\bcurrent (repo|code|app|project|workspace)\b/i.test(text)) return false;
  if (/\b(latest|current|today|recent|202[5-9])\b/i.test(text)) return true;
  return /\b(find|research|source|compare|look up|investigate)\b[\s\S]{0,80}\b(pricing|price|market|competitor|law|legal|medical|financial|tax|regulation|requirements?)\b/i.test(text);
}

function isDebuggingIntent(text: string): boolean {
  return DEBUGGING_RE.test(text) && !/\b(failure modes?|failed startups?|failures? of)\b/i.test(text) && !isExtractionDominant(text);
}

function isPracticalPlanIntent(text: string): boolean {
  if (!PRACTICAL_RE.test(text)) return false;
  if (/\b(choose between|which option|a or b)\b/i.test(text)) return false;
  if (/\b(recommend|decide)\b/i.test(text) && !/\bnext steps?\b/i.test(text)) return false;
  return true;
}

function isLearningIntent(text: string): boolean {
  if (/\b(study|quiz|teach|learn|tutor|eli5|mental model|walk me through|understand)\b/i.test(text)) return true;
  return /\bexplain\b/i.test(text) && !CAREER_RE.test(text);
}

function isCreativeIdeaIntent(text: string): boolean {
  return CREATIVE_RE.test(text) && /\b(brainstorm|ideas?|concepts?|story|premises|themes?|tagline|names?)\b/i.test(text);
}

function isReplyDraftIntent(roughPrompt: string, text: string): boolean {
  if (!REPLY_RE.test(text)) return false;
  return !/\b(edit|rewrite|copyedit|polish|tighten|improve wording|make this sound|make it sound)\b/i.test(roughPrompt);
}

function contextBudgetFor(mode: OptimizationMode): number {
  if (mode === "speed") return 1200;
  if (mode === "quality") return 3000;
  return 4500;
}

function outputBudgetFor(mode: OptimizationMode, pattern: RouterPattern, primitive: RouterValuePrimitive): number {
  if (mode === "speed") {
    if (
      pattern === "research_compare" ||
      pattern === "decision_matrix" ||
      pattern === "ui_redesign" ||
      pattern === "tool_workflow" ||
      primitive === "safety_uncertainty_contract"
    ) {
      return 360;
    }
    return 260;
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

function buildReferenceWorkflowLine(roughPrompt: string): string {
  const tool = detectReferenceToolName(roughPrompt);
  if (tool) {
    return `Use ${tool} first as the reference source: search for relevant screens, sections, examples, or docs; inspect returned evidence; and extract reusable patterns without copying proprietary UI exactly.`;
  }
  return "Use relevant UI references first: gather 3-5 product screens or sections, inspect them for reusable patterns, and avoid copying proprietary UI exactly.";
}

function detectReferenceToolName(roughPrompt: string): string | null {
  if (/\bmobbin\b/i.test(roughPrompt)) return roughPrompt.match(/\bmobbin\s+mcp\b/i)?.[0] ?? "Mobbin";
  if (/\bfigma\b/i.test(roughPrompt)) return "Figma";
  if (/\bweb search|search the web|browse\b/i.test(roughPrompt)) return "web search";
  if (/\bgithub\b/i.test(roughPrompt)) return "GitHub";
  if (/\bnotion\b/i.test(roughPrompt)) return "Notion";
  if (/\bgoogle drive\b/i.test(roughPrompt)) return "Google Drive";
  if (/\bsupabase\b/i.test(roughPrompt)) return "Supabase";
  if (/\bdataset\b/i.test(roughPrompt)) return "the provided dataset";
  if (/\bdocs?|documentation\b/i.test(roughPrompt)) return "the referenced docs";
  if (/\bmcp\b/i.test(roughPrompt)) return "the requested MCP tool";
  return null;
}

function safetyContractLine(primitive: RouterValuePrimitive): string | null {
  if (primitive !== "safety_uncertainty_contract") return null;
  return "For high-stakes claims, state uncertainty, avoid pretending to be a professional, recommend qualified expert/source verification where appropriate (doctor/clinician, lawyer, financial professional, or emergency help), and do not invent legal, medical, financial, or safety facts.";
}

function isUiRedesignRequest(text: string): boolean {
  if (/\bscreen\s+ocr\b/i.test(text)) return false;
  return UI_SURFACE_RE.test(text) && UI_DESIGN_ACTION_RE.test(text);
}
