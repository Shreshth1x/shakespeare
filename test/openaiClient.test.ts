import assert from "node:assert/strict";
import test from "node:test";
import { compileWithModel } from "../src/backend/openaiClient";

test("speed mode returns router fallback with metadata when no OpenAI key is configured", async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalMock = process.env.SHAKESPEARE_MOCK_MODEL;
  const originalRouter = process.env.SHAKESPEARE_FAST_ROUTER;

  delete process.env.OPENAI_API_KEY;
  process.env.SHAKESPEARE_MOCK_MODEL = "false";
  process.env.SHAKESPEARE_FAST_ROUTER = "true";

  try {
    const result = await compileWithModel({
      rough_prompt: "fix this auth bug",
      mode: "coding_agent",
      optimization_mode: "speed",
      context: {
        active_app: "Codex",
        selected_text: "fix this auth bug"
      }
    });

    assert.equal(result.model, "local-router-fallback");
    assert.equal(result.used_fallback, true);
    assert.equal(result.timed_out, false);
    assert.equal(result.route_pattern, "agent_fix");
    assert.equal(result.route_target, "codex");
    assert.match(result.optimized_prompt, /Inspect the relevant files/i);
    assert(result.context_char_count != null && result.context_char_count > 0);
  } finally {
    restoreEnv("OPENAI_API_KEY", originalKey);
    restoreEnv("SHAKESPEARE_MOCK_MODEL", originalMock);
    restoreEnv("SHAKESPEARE_FAST_ROUTER", originalRouter);
  }
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
