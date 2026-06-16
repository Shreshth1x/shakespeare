import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCompactObservedContext,
  buildRoutedPrompt,
  buildRouterFallback,
  buildRouterPacket,
  routePrompt
} from "../src/shared/promptRouter";

test("router selects coding-agent fix pattern for Codex prompts", () => {
  const decision = routePrompt({
    rough_prompt: "fix this auth bug",
    mode: "coding_agent",
    optimization_mode: "speed",
    context: {
      active_app: "Codex",
      window_title: "shakespeare"
    }
  });

  assert.equal(decision.target, "codex");
  assert.equal(decision.mode, "coding_agent");
  assert.equal(decision.pattern, "agent_fix");
  assert.equal(decision.failureMode, "agent_overbuild");
  assert.equal(decision.outputBudgetTokens, 260);
  assert.equal(decision.reasoningEffort, "none");
});

test("router turns Mobbin UI redesign asks into concrete reference-driven redesign prompts", () => {
  const routed = buildRoutedPrompt({
    rough_prompt: "use the mobbin mcp to redesign the electron app UI to be like whisper flow style of clean typography and colors",
    mode: "coding_agent",
    optimization_mode: "speed",
    context: {
      active_app: "Codex",
      window_title: "Codex",
      selected_text:
        "use the mobbin mcp to redesign the electron app UI to be like whisper flow style of clean typography and colors"
    }
  });

  assert.equal(routed.decision.target, "codex");
  assert.equal(routed.decision.mode, "coding_agent");
  assert.equal(routed.decision.pattern, "ui_redesign");
  assert.equal(routed.decision.failureMode, "missing_reference_workflow");
  assert.equal(routed.decision.outputBudgetTokens, 360);
  assert.match(routed.fallback, /Use mobbin mcp first/i);
  assert.match(routed.fallback, /Extract concrete visual decisions/i);
  assert.match(routed.fallback, /typography scale/i);
  assert.match(routed.fallback, /Electron renderer/i);
  assert.match(routed.fallback, /screenshot|visual check/i);
  assert.doesNotMatch(routed.fallback, /^Goal:/);
});

test("router lets Gmail and Slack override the default coding mode", () => {
  const decision = routePrompt({
    rough_prompt: "reply to this and keep it short",
    mode: "coding_agent",
    optimization_mode: "speed",
    context: {
      browser_url: "https://mail.google.com/mail/u/0/#inbox",
      browser_title: "Gmail"
    }
  });

  assert.equal(decision.target, "gmail");
  assert.equal(decision.mode, "writing_reply");
  assert.equal(decision.pattern, "reply_draft");
});

test("router flags current research as hallucination risk", () => {
  const routed = buildRoutedPrompt({
    rough_prompt: "find the latest competitor pricing for this",
    mode: "general",
    optimization_mode: "speed",
    context: {
      browser_hostname: "chatgpt.com",
      browser_visible_text: "SaaS pricing research notes"
    }
  });

  assert.equal(routed.decision.mode, "research");
  assert.equal(routed.decision.pattern, "research_compare");
  assert.equal(routed.decision.failureMode, "hallucination_risk");
  assert.match(routed.fallback, /current primary sources/i);
  assert.match(routed.fallback, /dates/i);
});

test("router builds a minified speed packet with compact context", () => {
  const request = {
    rough_prompt: "why is this broken",
    mode: "debugging" as const,
    optimization_mode: "speed" as const,
    context: {
      active_app: "Cursor",
      ide_relative_file_path: "src/auth/session.ts",
      ide_diagnostics: "Error at 12:7: Cannot read properties of undefined.",
      ide_visible_text: "x".repeat(4000)
    }
  };
  const decision = routePrompt(request);
  const context = buildCompactObservedContext(request.context, decision.contextBudgetChars, request.optimization_mode);
  const packet = buildRouterPacket(request, decision, context.text);
  const serialized = JSON.stringify(packet);

  assert.equal(decision.pattern, "debug_root_cause");
  assert(serialized.length < 1500);
  assert(!serialized.includes("\n"));
  assert(context.text.length <= 1200);
  assert(context.sources.includes("ide_diagnostics"));
});

test("router has a fallback template for every pattern", () => {
  const patterns = [
    "fix this bug",
    "why is this failing",
    "research the best option",
    "extract this into JSON",
    "reply to this email",
    "should I choose A or B",
    "brainstorm names",
    "make this clearer"
  ];

  for (const roughPrompt of patterns) {
    const request = {
      rough_prompt: roughPrompt,
      mode: "general" as const,
      optimization_mode: "speed" as const,
      context: {}
    };
    const decision = routePrompt(request);
    const fallback = buildRouterFallback(request, decision);
    assert(fallback.length > roughPrompt.length);
    assert(!fallback.includes("undefined"));
  }
});
