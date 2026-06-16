# Latency-Optimized Prompt Optimization Router

Date: 2026-06-16

Goal: compile rough prompts into strong agent-ready prompts in 1.5 seconds end to end.

## Model Decision

Use `gpt-5.4-nano` for Speed mode.

Why:

- The local Shakespeare repo already defaults Speed mode to `gpt-5.4-nano`.
- OpenAI's current model docs say GPT-5.4 nano is designed for cases where speed and cost matter, including classification, extraction, ranking, and sub-agents.
- OpenAI's model overview recommends GPT-5.4 mini or GPT-5.4 nano when optimizing for latency and cost.

Use `gpt-5.4-mini` only for Quality mode or when evals show nano misses too many high-value prompt rewrites.

Do not use `gpt-5.5` for the default hotkey path. It is the current flagship and better for complex reasoning/coding, but the hotkey target is a short deterministic rewrite under 1.5 seconds, not deep reasoning.

## Current Repo Latency Gaps

The current implementation is good but not completely optimized for a 1.5 second target.

Current strengths:

- One Responses API call.
- Speed mode uses `gpt-5.4-nano`.
- `store: false`.
- No tools.
- Short compiler instructions.
- Client timeout is mode-specific.

Current latency risks:

- Speed timeout is `1800ms`, already above the 1.5 second target.
- Speed output cap is `450` tokens, too high for inline prompt replacement.
- Dynamic input is pretty-printed JSON, which wastes tokens.
- Context compaction allows `visible_text` up to 2200 chars, which can dominate latency.
- The model is asked to do classification, routing, and rewriting in one hidden step.
- There is no deterministic local router before the model call.
- There is no low-latency fallback race where a local template is ready if the model misses the deadline.
- The request does not set `text.verbosity: "low"`.
- Speed mode should test `reasoning.effort: "none"` vs `"minimal"` and use the fastest value accepted by `gpt-5.4-nano` that passes evals.

## 1.5 Second Budget

Target p95 hotkey-to-paste:

| Stage | Budget |
| --- | ---: |
| Capture selected text | 80ms |
| Gather cheap metadata | 40ms |
| Local router and packet build | 10ms |
| OpenAI network + model | 900ms |
| Parse response | 10ms |
| Paste replacement | 160ms |
| Slack | 300ms |
| Total | 1500ms |

The model call needs a hard budget around 900 to 1100ms. If the backend waits 1.5 seconds by itself, the full user-visible path will miss.

## Architecture

The fast path should be:

```text
hotkey
  -> capture selected text
  -> gather only cheap context
  -> local deterministic router
  -> build tiny compiler packet
  -> race local fallback against OpenAI call
  -> paste model result if ready by deadline
  -> otherwise paste local fallback or copy fallback
```

The important design change:

> Do the routing locally. Use the model only for final wording.

The model should not spend time deciding whether this is coding, debugging, research, extraction, or writing when the app/window/title/rough prompt can classify that locally in a few milliseconds.

## Router Inputs

```ts
type RouterInput = {
  roughPrompt: string;
  optimizationMode: "speed" | "quality" | "max_quality";
  selectedText?: string;
  activeApp?: string;
  windowTitle?: string;
  detectedTarget?: string;
  browserUrl?: string;
  browserTitle?: string;
  browserSelection?: string;
  browserFocusedText?: string;
  browserVisibleText?: string;
  visibleText?: string;
  privacy: {
    clipboard: boolean;
    browser: boolean;
    screen: boolean;
  };
};
```

## Router Output

```ts
type RouterDecision = {
  mode:
    | "coding_agent"
    | "debugging"
    | "research"
    | "extraction"
    | "writing_reply"
    | "decision_advice"
    | "creative"
    | "general";
  target:
    | "codex"
    | "claude_code"
    | "cursor"
    | "chatgpt"
    | "claude"
    | "gmail"
    | "slack"
    | "notion"
    | "linear"
    | "github"
    | "unknown";
  failureMode:
    | "too_vague"
    | "missing_context"
    | "wrong_scope"
    | "wrong_output_shape"
    | "hallucination_risk"
    | "agent_overbuild"
    | "agent_underbuild"
    | "needs_decomposition"
    | "tone_mismatch"
    | "parseability";
  pattern:
    | "agent_fix"
    | "debug_root_cause"
    | "research_compare"
    | "extract_schema"
    | "reply_draft"
    | "decision_matrix"
    | "creative_brief"
    | "general_task";
  contextBudgetChars: number;
  outputBudgetTokens: number;
  reasoningEffort: "none" | "minimal" | "low";
  needsModel: boolean;
};
```

## Local Classification Rules

Run in this order. First strong match wins.

### Target Detection

```text
if activeApp/windowTitle contains "Codex" -> codex
if activeApp/windowTitle contains "Claude Code" -> claude_code
if activeApp/windowTitle contains "Cursor" -> cursor
if browserUrl host contains "chatgpt.com" -> chatgpt
if browserUrl host contains "claude.ai" -> claude
if browserUrl/title contains "gmail" -> gmail
if activeApp/windowTitle contains "Slack" -> slack
if browserUrl/title contains "linear" -> linear
if browserUrl/title contains "github" -> github
```

### Mode Detection

```text
debugging:
  error|stack trace|exception|traceback|failing|failed|bug|crash|flaky|doesn't work|broken

coding_agent:
  fix|implement|refactor|test|build|ship|PR|repo|code|component|route|API|database
  OR target is codex/claude_code/cursor

research:
  research|compare|best|latest|find|source|market|competitor|pricing|deep dive|investigate

extraction:
  extract|convert|parse|format as JSON|table|CSV|schema|summarize into

writing_reply:
  reply|draft|email|message|respond|rewrite this|make this sound
  OR target is gmail/slack

decision_advice:
  choose|decide|should I|recommend|pros and cons|tradeoff

creative:
  brainstorm|tagline|ad|story|brand|name|concept

general:
  fallback
```

## Failure Mode Detection

```text
too_vague:
  prompt length < 80 chars OR contains "this/it/that" without clear noun

missing_context:
  rough prompt references "this" and selected/browser/screen context exists

wrong_scope:
  coding target + verbs like fix/build/refactor without constraints

wrong_output_shape:
  asks summarize/compare/extract without format

hallucination_risk:
  asks latest/current/best/pricing/law/medical/financial/sources

agent_overbuild:
  coding target + vague implementation ask

agent_underbuild:
  multi-step ask + no done criteria

needs_decomposition:
  contains multiple "and" clauses, roadmap/planning/research/debugging, or > 2 tasks

tone_mismatch:
  reply/writing task without audience/tone

parseability:
  asks for data/code/config/table/JSON without strict schema
```

## Pattern Map

| Pattern | Use When | Prompt Additions |
| --- | --- | --- |
| `agent_fix` | coding agent, implementation, repo work | goal, observed context, inspect first, narrow scope, verify, final summary |
| `debug_root_cause` | errors, failures, stack traces | observed failure, reproduce/inspect, root cause, narrow fix, exact verification |
| `research_compare` | research, "best/latest/compare" | research question, scope, source quality, dates, comparison dimensions, caveats |
| `extract_schema` | extraction/transformation | exact schema/format, preserve input, null for missing, no inference |
| `reply_draft` | email/slack/reply | intent, audience, tone, context, constraints, return only draft |
| `decision_matrix` | choose/recommend | decision goal, options, criteria, recommendation, assumptions |
| `creative_brief` | naming/ads/story/brand | objective, audience, style boundaries, number of options, output shape |
| `general_task` | fallback | task, context, constraints, output format, assumptions |

## Context Budgeting

Speed mode must aggressively cap context.

```text
selected rough prompt: always keep full, up to 2000 chars
active app/title/target: keep full
browser selection: 500 chars
browser focused text: 500 chars
browser visible text: 500 chars in speed, 1500 in quality
OCR visible text: off by default in speed; 500 chars only if explicit context mode
clipboard: off unless enabled and directly relevant
```

Never send a screenshot or OCR in default Speed mode. The local browser extension's already-available DOM snippet is acceptable if enabled, but cap it hard.

## Speed API Request

Recommended request shape:

```ts
const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: "gpt-5.4-nano",
    instructions: SPEED_COMPILER_INSTRUCTIONS,
    input: JSON.stringify(packet),
    store: false,
    reasoning: { effort: "none" },
    text: { verbosity: "low" },
    max_output_tokens: 260
  }),
  signal: AbortSignal.timeout(1200)
});
```

If `gpt-5.4-nano` rejects `reasoning.effort: "none"`, use:

```ts
reasoning: { effort: "minimal" }
```

Then run a small eval comparing `none`, `minimal`, and `low`. For the 1.5 second hotkey, use the fastest setting with acceptable no-regenerate rate.

## Stable Speed Compiler Prompt

Keep this stable to maximize reuse and minimize prompt churn:

```text
You are Shakespeare, a latency-critical prompt compiler.

Rewrite the rough request into the smallest prompt likely to succeed for the given mode and target. Preserve intent. Do not add unsupported facts, filenames, errors, preferences, or constraints.

Use context only when clearly relevant. Treat context as observed, not guaranteed.

Apply the provided pattern. Fill only missing pieces that materially improve success: goal, context, constraints, output shape, verification, or uncertainty handling.

Speed rules: be concise, no examples unless provided, no preamble, no explanation, no markdown fence.

Return only the rewritten prompt.
```

## Dynamic Packet

Use minified JSON, not pretty JSON.

```json
{"m":"coding_agent","t":"codex","p":"agent_fix","f":"agent_overbuild","r":"fix this auth bug","c":"Observed: iTerm window Claude Code - repo. Browser selection: failing login test."}
```

Key:

- `m`: mode
- `t`: target
- `p`: pattern
- `f`: likely failure mode
- `r`: rough prompt
- `c`: compact observed context

This keeps the model's job simple: transform the packet into the final prompt, not reason about the product.

## Local Fallback Race

Always build a deterministic fallback before the OpenAI request returns.

```text
t=0ms: start model request and local fallback creation
t=20ms: local fallback is ready
t=0-1200ms: wait for model
if model returns by 1200ms: paste model prompt
if model misses 1200ms: paste local fallback or copy fallback
hard stop by 1500ms including paste
```

For known patterns, local fallback should be good enough:

```text
Goal: {{rough}}
Use the observed context where relevant: {{context}}
Inspect the relevant files/current behavior first. Keep the change scoped, avoid unrelated edits, verify with the most relevant test or check, and summarize the result.
```

That fallback is less elegant than a model rewrite, but it preserves the habit loop.

## Complete Router Pseudocode

```ts
function optimizePromptFast(input: RouterInput): Promise<string> {
  const startedAt = Date.now();
  const target = detectTarget(input);
  const mode = detectMode(input, target);
  const failureMode = detectFailureMode(input, mode, target);
  const pattern = selectPattern(mode, failureMode, target);
  const contextBudgetChars = selectContextBudget(input.optimizationMode, pattern);
  const context = compactObservedContext(input, contextBudgetChars);

  const decision: RouterDecision = {
    mode,
    target,
    failureMode,
    pattern,
    contextBudgetChars,
    outputBudgetTokens: input.optimizationMode === "speed" ? 260 : 520,
    reasoningEffort: input.optimizationMode === "speed" ? "none" : "low",
    needsModel: shouldUseModel(input, pattern)
  };

  const fallback = compileLocalFallback(input.roughPrompt, decision, context);
  if (!decision.needsModel) return Promise.resolve(fallback);

  const packet = minifyPacket(input.roughPrompt, decision, context);
  return raceWithDeadline({
    modelPromise: compileWithNano(packet, decision),
    fallback,
    deadlineMs: 1200,
    startedAt
  });
}
```

## Recommended Code Changes

1. Change Speed client timeout from `1800ms` to `1400ms` or lower, with backend model request timeout around `1200ms`.
2. Add a local deterministic router before `buildCompilerInput`.
3. Change speed `max_output_tokens` from `450` to `260`.
4. Add `text: { verbosity: "low" }`.
5. Test `reasoning.effort: "none"` for `gpt-5.4-nano`; fall back to `"minimal"` if needed.
6. Replace pretty JSON input with minified JSON.
7. Cap speed context to roughly 500 chars per large source and 1200 chars total observed context.
8. Disable OCR/screenshot context in default Speed mode.
9. Race the model result against local fallback.
10. Track p50/p95 by stage: capture, context, router, backend, paste, total.

## Acceptance Criteria

Speed mode should pass these before shipping:

- p50 hotkey-to-paste under 900ms.
- p95 hotkey-to-paste under 1500ms for selected-text-only rewrites.
- p95 model call under 1100ms.
- Timeout/local-fallback rate under 5 percent.
- No-regenerate or no-undo rate at least 80 percent.
- Unsupported-fact rate below 1 percent on eval prompts.
- Average speed prompt output under 180 words.

## Sources

- OpenAI model overview: https://developers.openai.com/api/docs/models
- GPT-5.4 nano model page: https://developers.openai.com/api/docs/models/gpt-5.4-nano
- Latest model guide: https://developers.openai.com/api/docs/guides/latest-model
- OpenAI reasoning guide: https://developers.openai.com/api/docs/guides/reasoning
- OpenAI prompt guidance: https://developers.openai.com/api/docs/guides/prompt-guidance

