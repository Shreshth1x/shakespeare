import { buildCompilerInput, buildCompilerInstructions, compilePromptLocally, contextUsed } from "../shared/promptCompiler.js";
import {
  SPEED_COMPILER_INSTRUCTIONS,
  buildRoutedPrompt,
  isUsableRouterModelOutput
} from "../shared/promptRouter.js";
import type { CompilePromptRequest, CompilePromptResponse, OptimizationMode } from "../shared/types.js";

interface OpenAIResponseShape {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
}

export async function compileWithModel(request: CompilePromptRequest): Promise<CompilePromptResponse> {
  if (request.optimization_mode === "speed" && process.env.SHAKESPEARE_FAST_ROUTER !== "false") {
    return compileSpeedWithRouter(request);
  }

  return compileLegacyWithModel(request);
}

async function compileSpeedWithRouter(request: CompilePromptRequest): Promise<CompilePromptResponse> {
  const startedAt = Date.now();
  const routed = buildRoutedPrompt(request);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || process.env.SHAKESPEARE_MOCK_MODEL === "true") {
    return routerFallbackResponse(routed, startedAt, {
      warning: apiKey ? undefined : "OPENAI_API_KEY is not configured; used local router fallback.",
      timedOut: false
    });
  }

  const model = selectModel(request.optimization_mode);
  const modelStartedAt = Date.now();
  try {
    const data = await requestOpenAI(
      apiKey,
      {
        model,
        instructions: SPEED_COMPILER_INSTRUCTIONS,
        input: routed.packetText,
        store: false,
        reasoning: { effort: routed.decision.reasoningEffort },
        text: { verbosity: "low" },
        max_output_tokens: routed.decision.outputBudgetTokens
      },
      speedModelDeadlineMs()
    );

    const optimizedPrompt = extractOutputText(data).trim();
    if (!isUsableRouterModelOutput(optimizedPrompt)) {
      return routerFallbackResponse(routed, startedAt, {
        warning: "Model returned an unusable rewrite; used local router fallback.",
        timedOut: false,
        model,
        backendLatencyMs: Date.now() - modelStartedAt
      });
    }

    return withRouterMetadata(
      {
        optimized_prompt: optimizedPrompt,
        context_used: routed.contextUsed,
        warnings: [],
        model,
        latency_ms: Date.now() - startedAt
      },
      routed,
      {
        usedFallback: false,
        timedOut: false,
        backendLatencyMs: Date.now() - modelStartedAt,
        outputCharCount: optimizedPrompt.length
      }
    );
  } catch (error) {
    const timedOut = isTimeoutError(error);
    return routerFallbackResponse(routed, startedAt, {
      warning: timedOut
        ? `Speed model missed the ${speedModelDeadlineMs()} ms deadline; used local router fallback.`
        : `Speed model failed; used local router fallback: ${error instanceof Error ? error.message : "unknown error"}`,
      timedOut,
      model,
      backendLatencyMs: Date.now() - modelStartedAt
    });
  }
}

async function compileLegacyWithModel(request: CompilePromptRequest): Promise<CompilePromptResponse> {
  const startedAt = Date.now();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || process.env.SHAKESPEARE_MOCK_MODEL === "true") {
    return {
      optimized_prompt: compilePromptLocally(request),
      context_used: contextUsed(request.context),
      warnings: apiKey ? [] : ["OPENAI_API_KEY is not configured; used local fallback."],
      model: "local-fallback",
      latency_ms: Date.now() - startedAt
    };
  }

  const model = selectModel(request.optimization_mode);
  const data = await requestOpenAI(
    apiKey,
    {
      model,
      instructions: buildCompilerInstructions(request.mode, request.optimization_mode, request.custom_mode),
      input: buildCompilerInput(request),
      store: false,
      reasoning: { effort: request.optimization_mode === "max_quality" ? "medium" : "low" },
      max_output_tokens: request.optimization_mode === "quality" ? 750 : 900
    },
    request.optimization_mode === "max_quality" ? 11000 : request.optimization_mode === "quality" ? 3000 : 4500
  );

  const optimizedPrompt = extractOutputText(data).trim();
  if (!optimizedPrompt) {
    throw new Error("OpenAI returned an empty prompt.");
  }

  return {
    optimized_prompt: optimizedPrompt,
    context_used: contextUsed(request.context),
    warnings: [],
    model,
    latency_ms: Date.now() - startedAt
  };
}

async function requestOpenAI(apiKey: string, body: Record<string, unknown>, timeoutMs: number): Promise<OpenAIResponseShape> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });

  const data = (await response.json()) as OpenAIResponseShape;
  if (!response.ok) {
    throw new Error(data.error?.message ?? `OpenAI request failed with ${response.status}`);
  }
  return data;
}

function routerFallbackResponse(
  routed: ReturnType<typeof buildRoutedPrompt>,
  startedAt: number,
  options: {
    warning?: string;
    timedOut: boolean;
    model?: string;
    backendLatencyMs?: number;
  }
): CompilePromptResponse {
  const fallback = routed.fallback;
  return withRouterMetadata(
    {
      optimized_prompt: fallback,
      context_used: routed.contextUsed,
      warnings: options.warning ? [options.warning] : [],
      model: options.model ? `${options.model}+fallback` : "local-router-fallback",
      latency_ms: Date.now() - startedAt
    },
    routed,
    {
      usedFallback: true,
      timedOut: options.timedOut,
      backendLatencyMs: options.backendLatencyMs,
      outputCharCount: fallback.length
    }
  );
}

function withRouterMetadata(
  response: CompilePromptResponse,
  routed: ReturnType<typeof buildRoutedPrompt>,
  metadata: {
    usedFallback: boolean;
    timedOut: boolean;
    backendLatencyMs?: number;
    outputCharCount?: number;
  }
): CompilePromptResponse {
  return {
    ...response,
    route_mode: routed.decision.mode,
    route_archetype: routed.decision.archetype,
    route_value_primitive: routed.decision.valuePrimitive,
    route_target: routed.decision.target,
    route_pattern: routed.decision.pattern,
    route_failure_mode: routed.decision.failureMode,
    used_fallback: metadata.usedFallback,
    timed_out: metadata.timedOut,
    routing_latency_ms: routed.routingLatencyMs,
    backend_latency_ms: metadata.backendLatencyMs,
    context_source_count: routed.contextSourceCount,
    context_char_count: routed.contextCharCount,
    output_char_count: metadata.outputCharCount ?? response.optimized_prompt.length
  };
}

function speedModelDeadlineMs(): number {
  const configured = Number(process.env.SHAKESPEARE_SPEED_MODEL_TIMEOUT_MS);
  if (Number.isFinite(configured) && configured >= 300) {
    return Math.min(configured, 1400);
  }
  return 1200;
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "TimeoutError" || error.name === "AbortError" || /timeout|aborted/i.test(error.message);
}

function selectModel(mode: OptimizationMode): string {
  if (mode === "speed") {
    return process.env.OPENAI_MODEL_SPEED || process.env.OPENAI_MODEL || "gpt-5.4-nano";
  }

  if (mode === "quality") {
    return process.env.OPENAI_MODEL_QUALITY || process.env.OPENAI_MODEL || "gpt-5.4-mini";
  }

  return process.env.OPENAI_MODEL_MAX_QUALITY || process.env.OPENAI_MODEL_QUALITY || process.env.OPENAI_MODEL || "gpt-5.4-mini";
}

function extractOutputText(data: OpenAIResponseShape): string {
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  const parts: string[] = [];
  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n");
}
