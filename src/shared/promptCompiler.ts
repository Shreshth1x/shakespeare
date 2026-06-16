import type { CompilePromptRequest, OptimizationMode, PromptMode, PromptContext } from "./types.js";

const MODE_GUIDANCE: Record<PromptMode, string> = {
  general:
    "Rewrite for a general LLM. Make the task clear, preserve intent, add useful constraints, and include an output format only when it helps.",
  coding_agent:
    "Rewrite for a coding agent. Ask it to inspect relevant files first, keep changes scoped, avoid unrelated edits, verify with tests or explain why it cannot, and summarize changed files.",
  debugging:
    "Rewrite for debugging. State the observed failure, request root-cause investigation, ask for a narrow fix, and require verification.",
  research:
    "Rewrite for research. Clarify the research question, scope, source expectations, comparison dimensions, caveats, and output format."
};

export function buildCompilerInstructions(mode: PromptMode, optimizationMode: OptimizationMode): string {
  const speedRule =
    optimizationMode === "speed"
      ? "Optimize for speed and brevity. Produce a strong rewrite, but do not over-elaborate."
      : "Optimize for a more careful rewrite. Add structure where it materially improves the prompt.";

  return [
    "You rewrite rough user requests into high-quality prompts for LLMs and coding agents.",
    "Preserve the user's intent. Do not add unsupported facts, file names, errors, constraints, or preferences.",
    "Use provided context only when it clearly helps. If context is ambiguous, phrase it as observed context.",
    "Return only the rewritten prompt. No preamble, no markdown fence, no explanation.",
    speedRule,
    MODE_GUIDANCE[mode]
  ].join("\n");
}

export function buildCompilerInput(request: CompilePromptRequest): string {
  const context = compactContext(request.context);

  return JSON.stringify(
    {
      rough_prompt: request.rough_prompt,
      mode: request.mode,
      optimization_mode: request.optimization_mode,
      context
    },
    null,
    2
  );
}

export function contextUsed(context: PromptContext | undefined): string[] {
  if (!context) return [];

  return Object.entries(context)
    .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    .map(([key]) => key);
}

export function compactContext(context: PromptContext | undefined): PromptContext {
  if (!context) return {};

  const compacted: PromptContext = {};
  for (const [key, value] of Object.entries(context) as Array<[keyof PromptContext, string | null | undefined]>) {
    if (typeof value === "string" && value.trim().length > 0) {
      compacted[key] = truncate(value.trim(), key === "visible_text" ? 2200 : 500);
    }
  }
  return compacted;
}

export function validateCompileRequest(input: unknown): { ok: true; value: CompilePromptRequest } | { ok: false; error: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const body = input as Partial<CompilePromptRequest>;
  if (typeof body.rough_prompt !== "string" || body.rough_prompt.trim().length === 0) {
    return { ok: false, error: "`rough_prompt` is required." };
  }

  const mode = body.mode ?? "general";
  if (!isPromptMode(mode)) {
    return { ok: false, error: "`mode` must be general, coding_agent, debugging, or research." };
  }

  const optimizationMode = body.optimization_mode ?? "speed";
  if (!isOptimizationMode(optimizationMode)) {
    return { ok: false, error: "`optimization_mode` must be speed, quality, or max_quality." };
  }

  return {
    ok: true,
    value: {
      rough_prompt: body.rough_prompt.trim(),
      mode,
      optimization_mode: optimizationMode,
      context: body.context ?? {}
    }
  };
}

export function compilePromptLocally(request: CompilePromptRequest): string {
  const context = compactContext(request.context);
  const visibleBits = [
    context.active_app ? `Active app: ${context.active_app}.` : null,
    context.window_title ? `Window: ${context.window_title}.` : null,
    context.detected_target ? `Detected target: ${context.detected_target}.` : null,
    context.visible_text ? `Observed context: ${context.visible_text}` : null
  ].filter(Boolean);

  if (request.mode === "coding_agent") {
    return [
      `Goal: ${request.rough_prompt}`,
      visibleBits.length ? `Context: ${visibleBits.join(" ")}` : null,
      "Start by inspecting the relevant files and current behavior before editing.",
      "Keep the change narrowly scoped, avoid unrelated refactors, and verify the result with the most relevant tests or checks.",
      "In your final response, summarize the cause, files changed, and verification result."
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (request.mode === "debugging") {
    return [
      `Investigate this issue: ${request.rough_prompt}`,
      visibleBits.length ? `Context: ${visibleBits.join(" ")}` : null,
      "Identify the likely root cause, propose the narrowest fix, implement it if appropriate, and verify the behavior."
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `Please help with the following task: ${request.rough_prompt}`,
    visibleBits.length ? `Use this observed context where relevant: ${visibleBits.join(" ")}` : null,
    "Preserve the intent, make the response clear and actionable, and state any assumptions."
  ]
    .filter(Boolean)
    .join("\n");
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function isPromptMode(value: unknown): value is PromptMode {
  return value === "general" || value === "coding_agent" || value === "debugging" || value === "research";
}

function isOptimizationMode(value: unknown): value is OptimizationMode {
  return value === "speed" || value === "quality" || value === "max_quality";
}
