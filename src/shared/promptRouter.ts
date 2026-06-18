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
  "Rewrite the rough request into the smallest useful prompt likely to prevent the next wasted turn.",
  "Preserve intent. Do not add unsupported facts, filenames, sources, errors, credentials, preferences, or constraints.",
  "Use observed context only when clearly relevant. Treat context as observed, not guaranteed.",
  "Use the packet's archetype, value primitive, and hint list internally. Add only the missing clarification: tool/source binding, evidence, schema, audience/tone, decision criteria, acceptance, reproduction, learning loop, visual verification, or uncertainty.",
  "Write the result as a normal user prompt. Do not mention routing, packets, internal hints, or any '<label> contract:' phrasing.",
  "Use short paragraphs or bullets when the prompt includes context, constraints, checks, or multiple asks, so the user can scan it before pressing Enter.",
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
  contract: string[];
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
  /\b(redesign|redeseign|restyle|polish|visual design|typography|colors?|palette|spacing|clean|cleaner|look like|look .*style|improve|benchmark|reference|inspiration|whisper flow|wispr flow|willow)\b/i;
const DESIGN_REFERENCE_TOOL_RE = /\b(mobbin|figma|design mcp|ui references?|product ui references?)\b/i;
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
const VISUAL_FEEDBACK_RE =
  /\b(does this|do these|is this|are these|how does this|what do you think|feedback on|critique|review)\b[\s\S]{0,90}\b(look|feel|read|work|good|cool|nice|polished|professional|clear|usable|design|logo|visual|screen|mockup|ui|layout|composition)\b/i;
const VISUAL_CONTEXT_RE =
  /\b(design|logo|brand|visual|image|screenshot|mockup|ui|layout|typography|palette|color|composition|figma|hero|poster|icon|landing page|screen|wireframe)\b/i;
const CREATIVE_RE = /\b(brainstorm|tagline|names?|ideas?|concepts?|story|premises|themes?|creative brief|slogan|naming|moodboard)\b/i;
const MULTI_STEP_RE = /\b(and then|also|after that|first|second|third|multiple|steps?|plan)\b/i;
const TONE_RE = /\b(tone|warm|concise|friendly|direct|professional|casual|audience|voice)\b/i;
const DEICTIC_RE = /\b(this|it|that|these|those|here)\b/i;
const CONTRACT_LABEL_RE =
  /(?:^|\n|\s)(?:Evidence|Critique|Judgment|Action|Discovery|Acceptance|Implementation|Verification|Output|Boundary|Schema|Fidelity|Audience|Decision|Tradeoff|Recommendation|Source|Extraction|Deliverable|Scope|Synthesis|Caveat|Level|Practice|Misconception|Positioning|Claims|Variant|Targeting|Fabrication|Generation|Constraint|Selection|Freshness|Visual|Coherence|Intent|Tone|Situation|Plan|Risk|Missing-slot)\s+contract:/i;

export function buildRoutedPrompt(request: CompilePromptRequest): RoutedPrompt {
  const startedAt = Date.now();
  const decision = routePrompt(request);
  const context = buildCompactObservedContext(
    request.context,
    decision.contextBudgetChars,
    request.optimization_mode,
    decision.pattern,
    request.rough_prompt
  );
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
    rough_prompt: truncate(request.rough_prompt, 2000),
    contract: buildContractSlots(request, decision).map((slot) => truncate(slot, 180))
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
      "Preserve intent, avoid unsupported facts, add only the missing clarification, and return only the rewritten prompt."
    ]);
  }

  const safetyLine = safetyContractLine(decision.valuePrimitive);

  switch (decision.pattern) {
    case "visual_feedback": {
      const visibleContext = cleanVisualContextForPrompt(compactContext);
      return joinLines([
        "Give quick design feedback on the visible logo/design.",
        `Focus: ${truncate(request.rough_prompt.trim(), 160)}`,
        visibleContext
          ? `Visible context:\n${trimTerminalPunctuation(visibleContext)}.`
          : "If you cannot see enough visual context, ask for a screenshot or clearer visual context.",
        "Please cover:\n- Whether it feels cool and polished overall.\n- What works best / feels strongest.\n- What feels weakest.\n- The top 2-3 improvements.",
        "Do not treat this as an implementation task or invent details you cannot see.",
        safetyLine
      ]);
    }
    case "ui_redesign":
      return joinLines([
        `Redesign the current app UI based on the request: ${request.rough_prompt}`,
        compactContext ? `Observed context: ${compactContext}` : null,
        `Use ${detectReferenceToolName(request.rough_prompt) ?? "the named reference source"} first when a reference is provided, then translate the reference into concrete UI decisions.`,
        broadUiNaturalScopeLine(request.rough_prompt),
        "Inspect the current renderer/components/styles, preserve existing behavior, and apply the redesign only to the relevant surfaces.",
        "Cover typography, spacing, palette, density, controls, empty states, and preview states.",
        "Verify with tests plus a screenshot or visual check, and summarize the references and changed files.",
        safetyLine
      ]);
    case "tool_workflow":
      return joinLines([
        `Use ${detectReferenceToolName(request.rough_prompt) ?? "the named tool/source"} before answering: ${request.rough_prompt}`,
        compactContext ? `Observed context: ${compactContext}` : null,
        "Inspect the named tool/source first, extract the facts, examples, constraints, or reference patterns that matter, then produce the requested deliverable.",
        "Tie the final answer directly to what the source showed, and do not invent tool results, credentials, unavailable files, or source-backed claims.",
        safetyLine
      ]);
    case "research_compare":
      return joinLines([
        `Research: ${request.rough_prompt}`,
        compactContext ? `Observed context: ${compactContext}` : null,
        "Define the scope and comparison dimensions first. Use current primary sources for volatile claims, include dates, separate evidence from interpretation, and call out caveats.",
        "Compare the strongest options and end with a concise recommendation or key takeaway.",
        safetyLine
      ]);
    case "decision_matrix":
      return joinLines([
        `Help make this decision: ${request.rough_prompt}`,
        compactContext ? `Observed context: ${compactContext}` : null,
        "Name the options, criteria, constraints, and tradeoffs. Compare each option against the criteria, recommend one path, and state what new information would change the answer.",
        safetyLine
      ]);
    case "agent_fix":
      return joinLines([
        `Work in the current repo on this request: ${request.rough_prompt}`,
        compactContext ? `Use observed context where relevant: ${compactContext}` : null,
        "Inspect the existing product flow and nearby code before editing. Define the smallest useful implementation slice and acceptance criteria, make only the scoped change, verify with the closest tests/checks, and summarize changed files plus evidence.",
        safetyLine
      ]);
    case "debug_root_cause":
      return joinLines([
        `Investigate the observed failure: ${request.rough_prompt}`,
        compactContext ? `Observed evidence: ${compactContext}` : null,
        "Use the evidence to reproduce or inspect the failing path, identify the root cause before editing, apply the narrowest fix if appropriate, and verify against the exact failure or closest check.",
        safetyLine
      ]);
    case "extract_schema":
      return joinLines([
        `Transform the input: ${request.rough_prompt}`,
        compactContext ? `Observed input/context: ${compactContext}` : null,
        "Return structured output only. Use a stable schema with clear fields, preserve source meaning, use null or explicit empty values for missing data, and do not infer unsupported details.",
        safetyLine
      ]);
    case "summarize_translate":
      return joinLines([
        `Summarize or translate: ${request.rough_prompt}`,
        compactContext ? `Source context: ${compactContext}` : null,
        "Preserve key facts, nuance, named entities, numbers, and uncertainty. Match the requested audience, length, language, and format, and do not add outside information.",
        safetyLine
      ]);
    case "teach_practice":
      return joinLines([
        `Teach: ${request.rough_prompt}`,
        compactContext ? `Learner/context clues: ${compactContext}` : null,
        "Assume the learner is smart but new unless a level is provided. Start with the mental model, use one concrete example, avoid unnecessary jargon, include 2-3 practice checks, and call out common misconceptions.",
        safetyLine
      ]);
    case "marketing_artifact":
      return joinLines([
        `Create the marketing artifact: ${request.rough_prompt}`,
        compactContext ? `Observed context: ${compactContext}` : null,
        "Specify audience, offer, channel, funnel stage, brand voice, and CTA before drafting. Make it fit the requested channel and do not invent claims, metrics, testimonials, guarantees, customers, or proof points.",
        safetyLine
      ]);
    case "career_artifact":
      return joinLines([
        `Create the career artifact: ${request.rough_prompt}`,
        compactContext ? `User/job context: ${compactContext}` : null,
        "Tailor it to the target role/company and requested format. Use only the user's supplied experience, resume, job description, or context, and do not fabricate credentials, employers, metrics, education, or responsibilities.",
        safetyLine
      ]);
    case "creative_brief":
      return joinLines([
        `Generate ideas for: ${request.rough_prompt}`,
        compactContext ? `Context: ${compactContext}` : null,
        "Produce a useful number of options, vary them across clear diversity axes, respect style and audience constraints, include one-line rationales, and mark the strongest options.",
        safetyLine
      ]);
    case "image_generation_prompt":
      return joinLines([
        `Create an image-generation prompt for: ${request.rough_prompt}`,
        compactContext ? `Visual/source context: ${compactContext}` : null,
        "Specify subject, composition, medium, style, color/light, key details, framing, negative constraints, and anything that must be avoided. Remove contradictory style instructions.",
        safetyLine
      ]);
    case "reply_draft":
      return joinLines([
        `Draft the reply: ${request.rough_prompt}`,
        compactContext ? `Conversation context: ${compactContext}` : null,
        "Infer the recipient, channel, relationship, and reply purpose from context when available. Match the tone, keep commitments conservative, avoid inventing facts or obligations, and return only the reply draft.",
        safetyLine
      ]);
    case "write_edit":
      return joinLines([
        `Write or edit: ${request.rough_prompt}`,
        compactContext ? `Source/context: ${compactContext}` : null,
        "Preserve the user's facts, goal, and meaning. Make audience, channel, tone, desired action, length, and format explicit where missing, and do not invent commitments, claims, or preferences.",
        safetyLine
      ]);
    case "practical_plan":
      return joinLines([
        `Create a practical plan for: ${request.rough_prompt}`,
        compactContext ? `Current situation/context: ${compactContext}` : null,
        "Identify the goal, constraints, resources, timeline, and unknowns. Prioritize the next 3-5 actions, call out risks and assumptions, include decision points, and end with the first concrete step.",
        safetyLine
      ]);
    case "general_task":
    default:
      return joinLines([
        `Task: ${request.rough_prompt}`,
        compactContext ? `Use this observed context only where relevant: ${compactContext}` : null,
        "Preserve the exact goal and explicit constraints. Add only the missing output shape, evidence, audience, or acceptance criterion that prevents ambiguity, avoid invented context, and make the request actionable.",
        safetyLine
      ]);
  }
}

export function buildCompactObservedContext(
  context: PromptContext | undefined,
  budgetChars: number,
  optimizationMode: OptimizationMode,
  pattern?: RouterPattern,
  roughPrompt = ""
): { text: string; sources: string[] } {
  if (!context || budgetChars <= 0) {
    return { text: "", sources: [] };
  }

  const speed = optimizationMode === "speed";
  const pieces: ContextPiece[] = pattern === "visual_feedback" ? visualFeedbackContextPieces(context, speed, roughPrompt) : [
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
    if (selectedPiece && pattern !== "visual_feedback") {
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

function visualFeedbackContextPieces(context: PromptContext, speed: boolean, roughPrompt: string): ContextPiece[] {
  const normalizedPrompt = normalizeForComparison(roughPrompt);
  const maybeFocusedText = normalizeForComparison(context.browser_focused_text) === normalizedPrompt ? null : context.browser_focused_text;

  return [
    piece("visible_text", "Visible screen context", context.visible_text, speed ? 900 : 2400),
    piece("browser_visible_text", "Browser page context", context.browser_visible_text, speed ? 900 : 2400),
    piece("browser_selection", "Browser selection", context.browser_selection, speed ? 500 : 1400),
    piece("browser_focused_text", "Focused browser text", maybeFocusedText, speed ? 500 : 1200)
  ].filter((candidate): candidate is ContextPiece => Boolean(candidate));
}

function cleanVisualContextForPrompt(compactContext: string): string {
  return compactContext
    .replace(/\b(?:Visible screen context|Browser page context|Browser selection|Focused browser text):\s*/gi, "")
    .replace(/\s*;\s*/g, "; ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimTerminalPunctuation(value: string): string {
  return value.replace(/[.!?]+$/g, "").trim();
}

export function isUsableRouterModelOutput(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 12) return false;
  if (/^```/.test(trimmed)) return false;
  if (/^\{[\s\S]*"optimized_prompt"/.test(trimmed)) return false;
  if (CONTRACT_LABEL_RE.test(trimmed)) return false;
  if (isLongSingleParagraph(trimmed)) return false;
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

  if (isVisualFeedbackRequest(roughPrompt, text)) return route("visual_design_feedback");
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
    case "visual_design_feedback":
      return { archetype, mode: "visual_feedback", pattern: "visual_feedback" };
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
  if (routeChoice.archetype === "visual_design_feedback") return "visual_feedback_contract";
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
  if (primitive === "visual_feedback_contract") return hasContext ? "missing_visual_verification" : "missing_visual_context";
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
  if (mode === "quality") return "low";
  return "medium";
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
  return parts.filter((part): part is string => Boolean(part)).map((part) => part.trim()).join("\n\n");
}

function isLongSingleParagraph(value: string): boolean {
  if (value.length <= 320) return false;
  return !/\n\s*\S/.test(value);
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  if (maxLength <= 3) return value.slice(0, maxLength);
  return `${value.slice(0, maxLength - 3)}...`;
}

function normalizeForComparison(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function buildReferenceWorkflowLine(roughPrompt: string): string {
  const tool = detectReferenceToolName(roughPrompt);
  if (tool) {
    return `Reference contract: Use ${tool} first as the reference source: search for relevant screens, sections, examples, or docs; inspect returned evidence; and extract reusable patterns without copying proprietary UI exactly.`;
  }
  return "Reference contract: use relevant UI references first: gather 3-5 product screens or sections, inspect them for reusable patterns, and avoid copying proprietary UI exactly.";
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

function buildContractSlots(request: CompilePromptRequest, decision: RouterDecision): string[] {
  switch (decision.pattern) {
    case "ui_redesign":
      return [
        buildReferenceWorkflowLine(request.rough_prompt),
        buildStyleReferenceLine(request.rough_prompt),
        broadUiScopeLine(request.rough_prompt),
        "Decision contract: extract concrete visual decisions before editing: typography scale, spacing rhythm, palette, density, controls, and empty/preview states.",
        "Implementation contract: inspect the Electron renderer/components/styles, preserve current behavior, then apply the redesign across the identified surfaces.",
        "Done contract means: updated UI code/styles, a design-decision summary with references used, and tests plus screenshot or visual check."
      ].filter((slot): slot is string => Boolean(slot));
    case "tool_workflow":
      return [
        "Source contract: run or inspect the named tool/source first, not after drafting the answer.",
        "Extraction contract: pull out the facts, examples, constraints, decisions, or reference patterns that should shape the deliverable.",
        "Deliverable contract: tie the final answer or implementation directly to what the tool/source showed; cite or summarize references when useful.",
        "Boundary contract: do not invent tool results, credentials, unavailable files, or source-backed claims."
      ];
    case "research_compare":
      return [
        "Scope contract: define the research question, inclusion/exclusion boundaries, and comparison dimensions before answering.",
        "Evidence contract: use current primary sources for volatile claims; include dates and separate evidence from interpretation.",
        "Synthesis contract: compare the strongest options across the chosen dimensions, then state the recommendation or key takeaways.",
        "Caveat contract: call out uncertainty, missing data, and what would change the conclusion."
      ];
    case "decision_matrix":
      return [
        "Decision contract: name the options, decision criteria, constraints, and weighting that matter here.",
        "Tradeoff contract: compare each option against the criteria instead of giving generic pros and cons.",
        "Recommendation contract: recommend one path, explain why, and state what new information would change the answer.",
        "Output contract: make the decision easy to scan, with assumptions separated from the recommendation."
      ];
    case "agent_fix":
      return [
        "Discovery contract: inspect the existing product flow and nearby code before editing; infer the intended behavior from existing patterns.",
        "Acceptance contract: define the smallest useful implementation slice and concrete acceptance criteria before making changes.",
        "Implementation contract: make the scoped change without unrelated refactors or behavior drift.",
        "Verification contract: verify with the closest tests/checks or explain why not, then summarize changed files and evidence."
      ];
    case "debug_root_cause":
      return [
        "Evidence contract: treat logs, stack traces, screenshots, and visible context as the starting evidence.",
        "Reproduction contract: reproduce or inspect the failing path before changing code.",
        "Root cause contract: identify why the failure happens, then apply the narrowest fix if appropriate.",
        "Verification contract: verify against the exact failure or closest available check and summarize cause, fix, and proof."
      ];
    case "extract_schema":
      return [
        "Schema contract: define a stable output shape with clear field names and types.",
        "Fidelity contract: preserve source meaning and structure; do not infer unsupported fields or add outside facts.",
        "Missing-value contract: use null or an explicit empty value for missing fields instead of guessing.",
        "Output contract: return structured output only, with consistent formatting."
      ];
    case "summarize_translate":
      return [
        "Fidelity contract: preserve key facts, nuance, named entities, numbers, and uncertainty.",
        "Audience contract: adapt length, language, and level of detail to the requested audience or format.",
        "Boundary contract: do not add outside information, claims, or interpretation unless asked.",
        "Output contract: produce the requested summary/translation shape and keep caveats visible."
      ];
    case "teach_practice":
      return [
        "Level contract: assume the learner is smart but new unless a level is provided.",
        "Mental model contract: start with the core intuition, then use one concrete example.",
        "Practice contract: include 2-3 practice questions or checks that reveal understanding.",
        "Misconception contract: call out likely traps and avoid unnecessary jargon."
      ];
    case "marketing_artifact":
      return [
        "Positioning contract: specify audience, offer, channel, funnel stage, brand voice, and CTA before drafting.",
        "Claims contract: do not invent metrics, testimonials, guarantees, customer names, or proof points.",
        "Variant contract: make the artifact usable for the requested channel, not generic marketing copy.",
        "Output contract: include the final copy plus any short rationale or assumptions only if useful."
      ];
    case "career_artifact":
      return [
        "Evidence contract: use only the user's supplied experience, resume, job description, or context as source material.",
        "Targeting contract: tailor the artifact to the target role/company and the requested format.",
        "Fabrication contract: do not fabricate credentials, employers, metrics, education, or responsibilities.",
        "Output contract: return the career artifact in a polished, ready-to-use structure."
      ];
    case "creative_brief":
      return [
        "Generation contract: produce a useful number of options and vary them across clear diversity axes.",
        "Constraint contract: respect style boundaries, audience, product context, and any forbidden directions.",
        "Selection contract: include a one-line rationale and mark the strongest options.",
        "Freshness contract: avoid obvious generic ideas unless explicitly requested."
      ];
    case "image_generation_prompt":
      return [
        "Visual contract: specify subject, composition, medium, style, color/light, and key details.",
        "Constraint contract: include framing, negative constraints, aspect ratio, and what must be avoided when relevant.",
        "Coherence contract: remove contradictory style instructions and keep the image prompt internally consistent.",
        "Output contract: return one clean image prompt, plus optional negative prompt only when useful."
      ];
    case "visual_feedback":
      return [
        "Use visible screen/context as evidence for the critique and do not invent unseen visual details.",
        "Evaluate composition, hierarchy, typography, color, polish, clarity, and brand fit.",
        "Answer whether it works overall, then name the strongest and weakest parts.",
        "Give 2-3 concrete improvements and ask for a screenshot if visual context is insufficient."
      ];
    case "reply_draft":
      return [
        "Audience contract: infer the recipient, channel, and relationship from context when available.",
        "Intent contract: state the reply's purpose before drafting: answer, decline, ask, confirm, apologize, or follow up.",
        "Tone contract: match the likely tone and keep commitments conservative.",
        "Output contract: do not invent facts or obligations; return only the reply draft."
      ];
    case "write_edit":
      return [
        "Intent contract: preserve the user's facts, goal, and meaning before changing style.",
        "Audience contract: make audience, channel, tone, desired action, length, and output format explicit where missing.",
        "Boundary contract: do not invent commitments, facts, claims, or preferences.",
        "Output contract: return the polished artifact in a ready-to-use form."
      ];
    case "practical_plan":
      return [
        "Situation contract: identify the goal, constraints, resources, timeline, and unknowns.",
        "Plan contract: prioritize the next 3-5 actions in sequence with decision points.",
        "Risk contract: call out risks, assumptions, and what would change the plan.",
        "Action contract: end with the first concrete step."
      ];
    case "general_task":
    default:
      return [
        "Intent contract: preserve the user's exact goal and any explicit constraints.",
        "Missing-slot contract: add only the output shape, evidence, audience, or acceptance criterion that prevents ambiguity.",
        "Boundary contract: do not invent facts, preferences, tools, files, or source material.",
        "Output contract: make the request actionable and state assumptions only when necessary."
      ];
  }
}

function isUiRedesignRequest(text: string): boolean {
  if (/\bscreen\s+ocr\b/i.test(text)) return false;
  if (UI_SURFACE_RE.test(text) && UI_DESIGN_ACTION_RE.test(text)) return true;
  return DESIGN_REFERENCE_TOOL_RE.test(text) && UI_DESIGN_ACTION_RE.test(text) && !isVolatileFactRequest(text);
}

function isVisualFeedbackRequest(roughPrompt: string, text: string): boolean {
  if (/\b(image prompt|generate an image|midjourney|stable diffusion|dall[- ]?e)\b/i.test(roughPrompt)) return false;
  if (VISUAL_FEEDBACK_RE.test(roughPrompt)) return true;
  if (!VISUAL_FEEDBACK_RE.test(text)) return false;
  return VISUAL_CONTEXT_RE.test(text);
}

function buildStyleReferenceLine(roughPrompt: string): string | null {
  if (!/\b(whisper flow|wispr flow|willow)\b/i.test(roughPrompt)) return null;
  return "Style contract: translate the requested Whisper/Wispr Flow-style direction into concrete UI rules: quiet typography, restrained palette, generous spacing, low-friction controls, and calm status/permission states.";
}

function broadUiScopeLine(roughPrompt: string): string | null {
  if (!/\beverything|all\b/i.test(roughPrompt)) return null;
  return "Scope contract: treat broad wording like \"everything\" as all primary visible app surfaces and states; identify those surfaces before editing.";
}

function broadUiNaturalScopeLine(roughPrompt: string): string | null {
  if (!/\beverything|all\b/i.test(roughPrompt)) return null;
  return "For broad wording like \"everything,\" identify all primary visible app surfaces and states before editing.";
}
