import { buildCompilerInput, buildCompilerInstructions, compilePromptLocally, contextUsed } from "../shared/promptCompiler.js";
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
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      instructions: buildCompilerInstructions(request.mode, request.optimization_mode),
      input: buildCompilerInput(request),
      store: false,
      reasoning: { effort: "minimal" },
      max_output_tokens: request.optimization_mode === "speed" ? 450 : 750
    })
  });

  const data = (await response.json()) as OpenAIResponseShape;
  if (!response.ok) {
    throw new Error(data.error?.message ?? `OpenAI request failed with ${response.status}`);
  }

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
