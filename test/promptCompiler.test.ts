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

test("validateCompileRequest accepts custom modes with instructions", () => {
  const result = validateCompileRequest({
    rough_prompt: "make this sharper",
    mode: "custom",
    optimization_mode: "speed",
    custom_mode: {
      name: "Architecture review",
      instructions: "Emphasize trade-offs, risks, and verification."
    }
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.mode, "custom");
    assert.equal(result.value.custom_mode?.name, "Architecture review");
  }
});

test("validateCompileRequest rejects custom modes without instructions", () => {
  const result = validateCompileRequest({
    rough_prompt: "make this sharper",
    mode: "custom"
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /custom_mode/);
  }
});

test("coding-agent instructions include scoped verification guidance", () => {
  const instructions = buildCompilerInstructions("coding_agent", "speed");

  assert.match(instructions, /inspect relevant files/i);
  assert.match(instructions, /avoid unrelated edits/i);
  assert.match(instructions, /Return only the rewritten prompt/i);
});

test("custom instructions include user-defined mode guidance", () => {
  const instructions = buildCompilerInstructions("custom", "speed", {
    name: "Architecture review",
    instructions: "Emphasize trade-offs and rollout risks."
  });

  assert.match(instructions, /Architecture review/);
  assert.match(instructions, /trade-offs/);
  assert.match(instructions, /Preserve the user's intent/);
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

test("local fallback includes browser context when provided", () => {
  const prompt = compilePromptLocally({
    rough_prompt: "summarize this",
    mode: "general",
    optimization_mode: "speed",
    context: {
      browser_url: "https://chatgpt.com/c/example",
      browser_selection: "Important thread text"
    }
  });

  assert.match(prompt, /Browser URL/);
  assert.match(prompt, /Important thread text/);
});

test("local fallback includes IDE context when provided", () => {
  const prompt = compilePromptLocally({
    rough_prompt: "fix this diagnostic",
    mode: "coding_agent",
    optimization_mode: "speed",
    context: {
      ide_editor: "Cursor",
      ide_workspace: "shakespeare",
      ide_relative_file_path: "src/main/index.ts",
      ide_language_id: "typescript",
      ide_selection: "const context = buildContext();",
      ide_diagnostics: "Error at 12:7: Cannot find name context.",
      ide_git_diff: "diff --git a/src/main/index.ts b/src/main/index.ts"
    }
  });

  assert.match(prompt, /IDE: Cursor/);
  assert.match(prompt, /Active file: src\/main\/index.ts/);
  assert.match(prompt, /Diagnostics: Error/);
  assert.match(prompt, /Git diff:/);
});

test("local fallback includes custom mode instructions", () => {
  const prompt = compilePromptLocally({
    rough_prompt: "review this plan",
    mode: "custom",
    optimization_mode: "speed",
    custom_mode: {
      name: "Operator brief",
      instructions: "Rewrite into a concise operator-facing brief with risks and next actions."
    },
    context: {
      active_app: "Shakespeare dashboard"
    }
  });

  assert.match(prompt, /Custom mode: Operator brief/);
  assert.match(prompt, /operator-facing brief/);
  assert.match(prompt, /Task: review this plan/);
});
