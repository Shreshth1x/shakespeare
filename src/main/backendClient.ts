import type { CompilePromptRequest, CompilePromptResponse, AppSettings } from "../shared/types";

export async function checkBackend(settings: AppSettings): Promise<boolean> {
  try {
    const response = await fetch(`${trimSlash(settings.backendUrl)}/healthz`, {
      signal: AbortSignal.timeout(1200)
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function compilePrompt(settings: AppSettings, request: CompilePromptRequest): Promise<CompilePromptResponse> {
  const response = await fetch(`${trimSlash(settings.backendUrl)}/v1/compile-prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(settings.clientToken ? { Authorization: `Bearer ${settings.clientToken}` } : {})
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(request.optimization_mode === "speed" ? 1500 : 3200)
  });

  const body = (await response.json()) as CompilePromptResponse | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body && body.error ? body.error : `Backend failed with ${response.status}`);
  }

  return body as CompilePromptResponse;
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
