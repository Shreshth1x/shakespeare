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
    assert.equal(result.route_archetype, "coding_implementation");
    assert.equal(result.route_value_primitive, "acceptance_contract");
    assert.match(result.optimized_prompt, /inspect the existing product flow and nearby code/i);
    assert.match(result.optimized_prompt, /acceptance criteria/i);
    assert.match(result.optimized_prompt, /verify with the closest tests\/checks/i);
    assert(result.context_char_count != null && result.context_char_count > 0);
  } finally {
    restoreEnv("OPENAI_API_KEY", originalKey);
    restoreEnv("SHAKESPEARE_MOCK_MODEL", originalMock);
    restoreEnv("SHAKESPEARE_FAST_ROUTER", originalRouter);
  }
});

test("speed mode rejects model output that leaks contract labels", async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalMock = process.env.SHAKESPEARE_MOCK_MODEL;
  const originalRouter = process.env.SHAKESPEARE_FAST_ROUTER;
  const originalFetch = globalThis.fetch;

  process.env.OPENAI_API_KEY = "test-key";
  process.env.SHAKESPEARE_MOCK_MODEL = "false";
  process.env.SHAKESPEARE_FAST_ROUTER = "true";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        output_text:
          "Evidence contract: use the screenshot.\nCritique contract: evaluate hierarchy.\nJudgment contract: say if it works."
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  try {
    const result = await compileWithModel({
      rough_prompt: "does this look cool?",
      mode: "coding_agent",
      optimization_mode: "speed",
      context: {
        active_app: "Codex",
        window_title: "Codex",
        detected_target: "Codex",
        visible_text: "Design chat: cool logo. Blue wordmark, rounded icon, and typography samples."
      }
    });

    assert.equal(result.used_fallback, true);
    assert.equal(result.route_archetype, "visual_design_feedback");
    assert.equal(result.route_pattern, "visual_feedback");
    assert.equal(result.route_value_primitive, "visual_feedback_contract");
    assert.match(result.optimized_prompt, /Visible context:\nDesign chat/i);
    assert.match(result.optimized_prompt, /Blue wordmark/i);
    assert.match(result.optimized_prompt, /Please cover:\n- Whether/i);
    assert.doesNotMatch(result.optimized_prompt, /\b[A-Z][A-Za-z-]+\s+contract:/);
    assert.doesNotMatch(result.optimized_prompt, /Implement in the current repo/i);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("OPENAI_API_KEY", originalKey);
    restoreEnv("SHAKESPEARE_MOCK_MODEL", originalMock);
    restoreEnv("SHAKESPEARE_FAST_ROUTER", originalRouter);
  }
});

test("speed mode rejects long unstructured model output before paste", async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalMock = process.env.SHAKESPEARE_MOCK_MODEL;
  const originalRouter = process.env.SHAKESPEARE_FAST_ROUTER;
  const originalFetch = globalThis.fetch;

  process.env.OPENAI_API_KEY = "test-key";
  process.env.SHAKESPEARE_MOCK_MODEL = "false";
  process.env.SHAKESPEARE_FAST_ROUTER = "true";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        output_text:
          "Please give design feedback on the visible logo and use the visible screen context as evidence while telling me whether it looks cool and polished overall, what works best, what feels weakest, and the top two or three improvements without treating it as an implementation task or inventing details that are not visible. Please also cover hierarchy, typography, color, polish, clarity, and brand fit in one concise answer."
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  try {
    const result = await compileWithModel({
      rough_prompt: "does this look cool?",
      mode: "coding_agent",
      optimization_mode: "speed",
      context: {
        active_app: "Codex",
        window_title: "Codex",
        detected_target: "Codex",
        visible_text: "Design chat: cool logo. Blue wordmark, rounded icon, and typography samples."
      }
    });

    assert.equal(result.used_fallback, true);
    assert.match(result.optimized_prompt, /Give quick design feedback/i);
    assert.match(result.optimized_prompt, /\n\nPlease cover:\n- Whether/i);
    assert.match(result.optimized_prompt, /Visible context:\nDesign chat/i);
  } finally {
    globalThis.fetch = originalFetch;
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
