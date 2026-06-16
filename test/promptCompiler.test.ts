import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCompilerInstructions,
  compilePromptLocally,
  contextUsed,
  validateCompileRequest
} from "../src/shared/promptCompiler";

test("validateCompileRequest accepts a minimal request", () => {
  const result = validateCompileRequest({
    rough_prompt: "fix this flaky test",
    mode: "coding_agent",
    optimization_mode: "speed"
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.mode, "coding_agent");
    assert.equal(result.value.optimization_mode, "speed");
  }
});

test("validateCompileRequest rejects unsupported modes", () => {
  const result = validateCompileRequest({
    rough_prompt: "rewrite this",
    mode: "essay"
  });

  assert.equal(result.ok, false);
});

test("coding-agent instructions include scoped verification guidance", () => {
  const instructions = buildCompilerInstructions("coding_agent", "speed");

  assert.match(instructions, /inspect relevant files/i);
  assert.match(instructions, /avoid unrelated edits/i);
  assert.match(instructions, /Return only the rewritten prompt/i);
});

test("contextUsed reports only non-empty context fields", () => {
  assert.deepEqual(
    contextUsed({
      active_app: "Cursor",
      window_title: "",
      selected_text: "fix this",
      visible_text: null
    }),
    ["active_app", "selected_text"]
  );
});

test("local fallback creates a useful coding-agent prompt", () => {
  const prompt = compilePromptLocally({
    rough_prompt: "fix the auth bug",
    mode: "coding_agent",
    optimization_mode: "speed",
    context: {
      active_app: "iTerm",
      window_title: "Claude Code - repo"
    }
  });

  assert.match(prompt, /Goal: fix the auth bug/);
  assert.match(prompt, /inspect/);
  assert.match(prompt, /verify/);
});
