# Shakespeare PRD: Latency-Optimized Prompt Router

## 1. Summary

The Latency-Optimized Prompt Router is the core optimization layer inside Shakespeare. It turns a rough prompt into a high-quality, agent-ready prompt in under 1.5 seconds by routing the prompt locally before making a small, fast model call.

The key product bet:

> Shakespeare should not try to produce the theoretically perfect prompt on every hotkey press. It should choose the right prompt pattern instantly, apply only the cheapest useful technique, and preserve the user's flow.

Default Speed mode uses `gpt-5.4-nano` for the model rewrite step. The local app performs classification, failure-mode detection, context budgeting, prompt-pattern selection, and local fallback generation before or alongside the model call.

This PRD is a companion to `CONTEXT_AWARE_PROMPT_COMPILER_PRD.md`. It narrows the optimization strategy for the 1.5 second hotkey path.

## 2. Problem

The existing Shakespeare product thesis depends on habit-forming latency. If a rewrite feels instant, users will press the hotkey many times per day. If it takes too long, they will revert to manually writing prompts.

Prompt optimization creates a tension:

- Better prompts often require more context, more structure, more reasoning, and sometimes multiple candidates.
- Fast inline replacement requires one small request, short inputs, short outputs, and aggressive timeouts.

The product therefore needs a router that decides what matters before calling the model.

Without a router, Speed mode risks:

- Sending too much context.
- Asking the model to infer workflow and rewrite in one step.
- Producing prompts that are longer than needed.
- Timing out after the user has lost flow.
- Adding generic prompt-engineering boilerplate instead of the one missing control surface.

## 3. Product Thesis

Prompt optimization under a 1.5 second deadline is a routing problem.

The router should:

1. Classify the target workflow locally.
2. Diagnose the rough prompt's likely failure mode locally.
3. Select the smallest work-saving prompt primitive locally.
4. Send `gpt-5.4-nano` a compact packet for final wording.
5. Race the model result against a deterministic local fallback.
6. Paste the best available result before the deadline.

The system should feel like:

> The prompt I would have written if I paused for 90 seconds, delivered before I lose flow.

### 3.1 Updated Optimization Standard

The router is not successful merely because it adds "inspect files," "keep scope narrow," or "run tests." Those are basic agent hygiene and often do not change the first run.

The router is successful when it adds a missing work contract that saves time:

- Explicit tool or MCP use.
- Reference gathering and extraction.
- Concrete deliverables.
- Acceptance criteria.
- Evidence/source requirements.
- Schema and missing-value rules.
- Visual or behavioral verification targets.
- Audience/tone/commitment boundaries.

If a rewrite does not prevent a likely follow-up, wrong workflow, or unverifiable output, it is probably not optimized enough.

## 4. Goals

### 4.1 Product Goals

- Make the default hotkey rewrite feel effectively instant.
- Improve most rough prompts enough to avoid immediate reprompting.
- Preserve user intent without inventing details.
- Keep Speed mode useful even when the model call misses the deadline.
- Make routing behavior observable enough to debug and evaluate.

### 4.2 Latency Goals

| Metric | Target |
| --- | ---: |
| Speed p50 hotkey-to-paste | < 900 ms |
| Speed p95 selected-text-only hotkey-to-paste | < 1500 ms |
| Speed p95 backend model wait | < 1100 ms |
| Speed timeout/local-fallback rate | < 5% |
| Quality p95 selected-text-only hotkey-to-paste | < 3000 ms |

### 4.3 Quality Goals

| Metric | Target |
| --- | ---: |
| No-regenerate or no-undo rate | >= 80% |
| Unsupported fact rate on eval set | < 1% |
| Correct pattern selection on eval set | >= 90% |
| Average Speed output length | <= 180 words |
| Speed prompts with redundant boilerplate | < 5% |

## 5. Non-Goals

For the Speed path, this system is not:

- A multi-candidate prompt optimizer.
- A dataset-backed prompt search loop.
- A chain-of-thought generator.
- A deep reasoning agent.
- A browser/search agent.
- A screenshot/OCR-first context engine.
- A prompt marketplace or prompt library.

These can exist in Quality, Max Quality, eval tooling, or future background optimization flows, but not in the default hotkey path.

## 6. Model Policy

### 6.1 Speed Mode

Default model: `gpt-5.4-nano`

Use this model because OpenAI's model overview recommends smaller variants such as GPT-5.4 mini or GPT-5.4 nano for latency- and cost-sensitive workloads. The `gpt-5.4-nano` model page positions it as the cheapest GPT-5.4-class model for simple high-volume tasks.

Speed mode request policy:

- One Responses API call.
- No tools.
- No web search.
- No image input.
- No screenshot/OCR context unless the user explicitly invokes context mode.
- `store: false`.
- `text.verbosity: "low"`.
- `max_output_tokens`: start at `260`.
- `reasoning.effort`: test `"none"` first; fall back to `"minimal"` if unsupported or worse in evals.
- Backend model deadline: around `1100-1200 ms`.

### 6.2 Quality Mode

Default model: `gpt-5.4-mini`

Quality mode can use:

- More context.
- Longer output budget.
- Slightly more structure.
- A brief internal self-check instruction.
- A longer timeout.

It should still prefer one model call.

### 6.3 Max Quality / Offline

Max Quality can use a stronger model and slower flows, but it must be explicit. Offline prompt optimization can use evals, multiple candidates, user feedback, and template search. It should improve Shakespeare's compiler prompts over time, not block inline use.

### 6.4 Current Source Notes

Verified on 2026-06-16:

- OpenAI model overview: https://developers.openai.com/api/docs/models
- GPT-5.4 nano model page: https://developers.openai.com/api/docs/models/gpt-5.4-nano
- Latest model guide: https://developers.openai.com/api/docs/guides/latest-model
- Reasoning guidance: https://developers.openai.com/api/docs/guides/reasoning

## 7. Core User Stories

### 7.1 Coding Agent Hotkey

As a developer in Codex, Claude Code, Cursor, or a terminal, I type "fix this auth bug", press the hotkey, and Shakespeare replaces it with a scoped coding-agent prompt before I lose flow.

Expected rewrite pattern:

- Goal.
- Observed context if useful.
- Inspect before editing.
- Narrow fix.
- Verification.
- Concise final summary expectation.

### 7.2 Debugging Hotkey

As a developer looking at a stack trace or failing test, I type "why is this broken", press the hotkey, and Shakespeare generates a debugging prompt that asks for root cause, narrow fix, and verification against the observed failure.

### 7.3 Research Hotkey

As a founder or operator, I type "find the best way to do this", press the hotkey, and Shakespeare turns it into a research prompt with scope, source expectations, comparison dimensions, caveats, and output format.

### 7.4 Reply Hotkey

As a user in Gmail or Slack, I type "reply to this", press the hotkey, and Shakespeare uses selected or visible context to produce a prompt that asks the LLM for an appropriate reply with the right audience, tone, and format.

### 7.5 Timeout Fallback

As a user on a slow network, I press the hotkey and still receive a useful prompt because Shakespeare pastes the local fallback if the model result misses the deadline.

## 8. End-to-End Flow

```text
hotkey
  -> capture selected text
  -> gather cheap metadata
  -> local deterministic router
  -> compact context packet
  -> deterministic local fallback
  -> gpt-5.4-nano request
  -> race model vs deadline
  -> paste model result if available
  -> otherwise paste fallback
  -> record latency and routing metadata
```

The user should not see the router. They should only see the replacement happen quickly.

## 9. Latency Budget

| Stage | Target Budget |
| --- | ---: |
| Hotkey dispatch | 20 ms |
| Capture selected text | 80 ms |
| Gather app/window/browser metadata | 40 ms |
| Local route decision | 10 ms |
| Build compact packet and fallback | 20 ms |
| Backend/network/model wait | 900-1100 ms |
| Parse response | 10 ms |
| Paste replacement | 160 ms |
| Slack | 60-260 ms |
| Total | <= 1500 ms |

If the backend/model call consumes the entire 1.5 seconds, the product fails. The model deadline must be shorter than the user-visible deadline.

## 10. Router Contract

### 10.1 Router Input

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

### 10.2 Router Output

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
    | "ui_redesign"
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

## 11. Routing Algorithm

### 11.0 Prompt Value Primitives

Before choosing a generic mode template, the router should check for high-leverage primitives.

| Primitive | Trigger | What To Add |
| --- | --- | --- |
| Tool binding | User names Mobbin, Figma, MCP, web search, a connector, or a required source | Use the tool first, what to search/query, what to inspect, and how it informs the output |
| Reference extraction | User asks for a style, design direction, benchmark, inspiration, or examples | Extract concrete decisions: typography, spacing, palette, density, structure, tone, or conventions |
| Deliverable contract | User asks to build, redesign, write, research, or create | Name the concrete artifacts expected at the end |
| Acceptance criteria | User says make/fix/improve/polish without done criteria | Define how the agent knows the task is complete |
| Evidence contract | User asks for current, best, latest, pricing, legal, medical, financial, market, or competitor facts | Require sources, dates, caveats, and evidence/interpretation separation |
| Schema contract | User asks to extract, parse, convert, JSON, CSV, or table | Define output shape, null policy, no-inference rule |
| Visual verification | User asks for UI/frontend/design/polish | Require screenshot, viewport, or visual check where possible |

Rank primitives by expected time saved. A high-leverage primitive should override a generic mode pattern.

### 11.1 Target Detection

Use deterministic rules before model calls.

| Signal | Target |
| --- | --- |
| Active app or window contains `Codex` | `codex` |
| Active app or window contains `Claude Code` | `claude_code` |
| Active app or window contains `Cursor` | `cursor` |
| Browser host contains `chatgpt.com` | `chatgpt` |
| Browser host contains `claude.ai` | `claude` |
| Browser URL/title contains `gmail` | `gmail` |
| Active app/window contains `Slack` | `slack` |
| Browser URL/title contains `linear` | `linear` |
| Browser URL/title contains `github` | `github` |

### 11.2 Mode Detection

Run in priority order. First strong match wins unless the user explicitly selected a mode.

| Mode | Signals |
| --- | --- |
| `debugging` | `error`, `stack trace`, `exception`, `traceback`, `failing`, `failed`, `bug`, `crash`, `flaky`, `broken`, `doesn't work` |
| `coding_agent` | `fix`, `implement`, `refactor`, `test`, `build`, `ship`, `PR`, `repo`, `code`, `component`, `route`, `API`, `database`; or target is Codex, Claude Code, or Cursor |
| `research` | `research`, `compare`, `best`, `latest`, `find`, `source`, `market`, `competitor`, `pricing`, `deep dive`, `investigate` |
| `extraction` | `extract`, `convert`, `parse`, `format as JSON`, `table`, `CSV`, `schema`, `summarize into` |
| `writing_reply` | `reply`, `draft`, `email`, `message`, `respond`, `rewrite this`, `make this sound`; or target is Gmail or Slack |
| `decision_advice` | `choose`, `decide`, `should I`, `recommend`, `pros and cons`, `tradeoff` |
| `creative` | `brainstorm`, `tagline`, `ad`, `story`, `brand`, `name`, `concept` |
| `general` | fallback |

### 11.3 Failure Mode Detection

| Failure Mode | Signals |
| --- | --- |
| `too_vague` | Prompt length under 80 chars, or uses `this`, `it`, `that` without a clear noun |
| `missing_context` | Prompt references `this` and selected/browser/screen context exists |
| `wrong_scope` | Coding target plus implementation verb but no constraints |
| `wrong_output_shape` | Summarize/compare/extract request without format |
| `hallucination_risk` | `latest`, `current`, `best`, `pricing`, legal, medical, financial, or source-sensitive request |
| `agent_overbuild` | Coding target plus vague build/fix/refactor request |
| `agent_underbuild` | Multi-step ask with no done criteria |
| `needs_decomposition` | Multiple tasks, long prompt, or planning/debugging/research request |
| `tone_mismatch` | Reply/writing task without audience or tone |
| `parseability` | Data/code/config/table/JSON output requested without schema |

### 11.4 Pattern Selection

| Pattern | Use When | Required Additions |
| --- | --- | --- |
| `agent_fix` | Coding agent or repo work | Goal, observed context, inspect first, narrow scope, verify, final summary |
| `ui_redesign` | UI/frontend/redesign/polish with design references, Mobbin, Figma, MCP, typography, color, spacing, or layout | Required reference/tool use, visual decision extraction, implementation target, functionality preservation, visual verification |
| `debug_root_cause` | Error, failure, crash, failing test | Observed failure, reproduce/inspect, root cause, narrow fix, exact verification |
| `research_compare` | Research, best/latest/compare | Research question, scope, source quality, dates, comparison dimensions, caveats |
| `extract_schema` | Extraction/transformation | Exact format/schema, preserve input, null for missing, no inference |
| `reply_draft` | Email, Slack, reply, writing | Intent, audience, tone, context, return only draft |
| `decision_matrix` | Choice or recommendation | Decision goal, options, criteria, recommendation, assumptions |
| `creative_brief` | Naming, creative, brand, ad | Objective, audience, style boundaries, number of options, output shape |
| `general_task` | Fallback | Task, context, constraints, output format, assumptions |

## 12. Context Budget Policy

Speed mode must not blindly pass all available context.

| Context Source | Speed Budget |
| --- | ---: |
| Rough prompt | full, up to 2000 chars |
| Active app | full |
| Window title | full |
| Detected target | full |
| Browser URL/title | full |
| Browser selected text | 500 chars |
| Browser focused text | 500 chars |
| Browser visible text | 500 chars |
| OCR visible text | off by default; 500 chars only in explicit context mode |
| Clipboard | off unless enabled and directly relevant |
| Total observed context | target <= 1200 chars |

Quality mode can raise large-context budgets to 1500-3000 chars depending on mode, but must still compact aggressively.

## 13. Prompt Packet

The model should receive a small minified packet, not pretty-printed JSON.

Example:

```json
{"m":"coding_agent","t":"codex","p":"agent_fix","f":"agent_overbuild","r":"fix this auth bug","c":"Observed: iTerm window Claude Code - repo. Browser selection: failing login test."}
```

Keys:

- `m`: mode
- `t`: target
- `p`: pattern
- `f`: likely failure mode
- `r`: rough prompt
- `c`: compact observed context

The packet should make the model's job mostly phrasing, not product reasoning.

## 14. Speed Compiler Instruction

Use a stable instruction prefix to reduce prompt churn and improve cacheability.

```text
You are Shakespeare, a latency-critical prompt compiler.

Rewrite the rough request into the smallest prompt likely to succeed for the given mode and target. Preserve intent. Do not add unsupported facts, filenames, errors, preferences, or constraints.

Use context only when clearly relevant. Treat context as observed, not guaranteed.

Apply the provided pattern. Fill only missing pieces that materially improve success: goal, context, constraints, output shape, verification, or uncertainty handling.

Speed rules: be concise, no examples unless provided, no preamble, no explanation, no markdown fence.

Return only the rewritten prompt.
```

## 15. OpenAI Request Shape

Recommended Speed request:

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

Fallback if `reasoning.effort: "none"` is rejected or performs worse in evals:

```ts
reasoning: { effort: "minimal" }
```

The product should run an A/B eval of `none` vs `minimal` before locking this setting.

## 16. Local Fallback

The local fallback must be generated synchronously before the model response returns.

Fallback policy:

- Build fallback immediately after router decision.
- Use pattern-specific templates.
- Keep fallback concise.
- Paste fallback if the model misses the deadline.
- Optionally replace fallback with model output only in preview mode, not after inline paste.

Example `agent_fix` fallback:

```text
Goal: {{rough_prompt}}
Use the observed context where relevant: {{context}}
Inspect the relevant files and current behavior first. Keep the change scoped, avoid unrelated edits, verify with the most relevant test or check, and summarize the result.
```

Example `ui_redesign` fallback:

```text
Redesign task: {{rough_prompt}}
Use {{named_reference_tool_or_source}} first as the reference source: search for relevant screens or sections, inspect the returned visuals/design context, and extract reusable patterns without copying proprietary UI exactly.
Extract concrete visual decisions before editing: typography scale, spacing rhythm, color palette, component density, control styling, and empty-state/preview behavior.
Then inspect the current Electron renderer, components, and styles. Implement a scoped redesign that preserves existing functionality.
Deliverables: updated UI code/styles, a short design-decision summary with references used, and verification with relevant tests plus a local screenshot or visual check when possible.
```

This is the difference between agent hygiene and useful optimization. The generic fallback says "inspect files and verify." The UI redesign fallback tells the agent how to turn a design-reference request into a concrete implementation workflow.

Example `research_compare` fallback:

```text
Research: {{rough_prompt}}
Define the scope, use current primary sources for time-sensitive claims, compare the strongest options across clear dimensions, call out caveats, and return a concise recommendation with sources.
```

## 17. Timeout and Race Policy

Speed mode should not wait indefinitely for a perfect model rewrite.

```text
t=0 ms      hotkey pressed
t=0-150 ms  selected text and cheap metadata captured
t=150 ms    router decision and local fallback ready
t=150 ms    gpt-5.4-nano request in flight
t=1200 ms   model deadline
t=1500 ms   user-visible paste deadline
```

If the model returns before the deadline:

- Validate non-empty output.
- Ensure output is not obviously malformed.
- Paste model result.

If the model misses the deadline:

- Abort or ignore the request.
- Paste local fallback.
- Record timeout/fallback event.

If replacement fails:

- Put the best available prompt on clipboard.
- Show failure toast.
- Preserve native undo behavior where possible.

## 18. Privacy and Safety Requirements

- Do not send clipboard, browser, or screen context unless the user enabled that source.
- Treat context as observed context, not confirmed fact.
- Do not infer file names, errors, product facts, or user preferences from weak context.
- Do not log raw prompt text unless local history is explicitly enabled.
- Log routing metadata without prompt content by default.
- Keep `store: false` for OpenAI calls unless product requirements change.
- For high-stakes prompts, add uncertainty/source requirements instead of confident claims.

## 19. Telemetry and Instrumentation

Record privacy-safe metadata for every rewrite:

```ts
type RewriteTelemetry = {
  startedAt: number;
  totalLatencyMs: number;
  captureLatencyMs?: number;
  routingLatencyMs?: number;
  backendLatencyMs?: number;
  pasteLatencyMs?: number;
  optimizationMode: "speed" | "quality" | "max_quality";
  model?: string;
  routeMode: RouterDecision["mode"];
  target: RouterDecision["target"];
  pattern: RouterDecision["pattern"];
  failureMode: RouterDecision["failureMode"];
  contextSourceCount: number;
  contextCharCount: number;
  outputCharCount?: number;
  usedFallback: boolean;
  timedOut: boolean;
  replacementSucceeded: boolean;
};
```

Do not include raw prompt text, selected text, clipboard text, browser text, or OCR text in telemetry unless the user explicitly enabled local-only history.

## 20. Evaluation Plan

Create an eval set with at least 110 prompts:

| Category | Count |
| --- | ---: |
| Coding-agent rough prompts | 20 |
| Debugging prompts with visible errors | 20 |
| UI redesign/reference-tool prompts | 10 |
| Research prompts | 20 |
| Extraction/transformation prompts | 20 |
| Writing/reply prompts | 20 |
| Ambiguous/adversarial prompts | 10 |

Score each rewrite on:

- Intent preservation.
- Unsupported-fact avoidance.
- Correct target detection.
- Correct mode detection.
- Correct pattern selection.
- Scope control.
- Output format clarity.
- Length.
- Latency.
- Human acceptance.

Evaluation should compare:

- Existing compiler vs router compiler.
- `reasoning.effort: "none"` vs `"minimal"`.
- `max_output_tokens: 220`, `260`, and `320`.
- Context budgets of 500, 1200, and 2000 chars.
- Pretty JSON vs minified packet.

## 21. Product UX

The router should stay invisible in normal use.

Optional advanced surfaces:

- Context receipt can show `Mode`, `Pattern`, `Context used`, `Model`, and `Latency`.
- Debug build can show route decision.
- Settings can expose Speed/Quality, but not every router knob.
- Dashboard can show average latency and fallback rate.

Do not make the user choose patterns manually in P0. The product promise is "press hotkey", not "configure prompt engineering."

## 22. Implementation Plan

### Phase 1: Router Core

- Add `src/shared/promptRouter.ts`.
- Implement target detection.
- Implement mode detection.
- Implement failure-mode detection.
- Implement pattern selection.
- Implement context budgeting.
- Add unit tests for router decisions.

### Phase 2: Compact Packets and Fallbacks

- Add `buildRouterPacket`.
- Replace pretty JSON input in Speed mode with minified packet.
- Add pattern-specific local fallback templates.
- Add tests for fallback quality and context compaction.

### Phase 3: Speed API Settings

- Update Speed `max_output_tokens` from `450` to `260`.
- Add `text: { verbosity: "low" }`.
- Test `reasoning.effort: "none"` with `gpt-5.4-nano`.
- Reduce Speed backend timeout to around `1200 ms`.
- Reduce client timeout so total hotkey-to-paste can stay under `1500 ms`.

### Phase 4: Deadline Race

- Build fallback before model call completes.
- Race model response against deadline.
- Paste model result if available.
- Paste fallback if model misses deadline.
- Track `usedFallback` and `timedOut`.

### Phase 5: Instrumentation and Evals

- Add stage-level latency metrics.
- Add route-decision telemetry without raw text.
- Create eval fixtures.
- Add scripts to compare output quality and latency.

### Phase 6: Rollout

- Ship behind a feature flag: `SHAKESPEARE_FAST_ROUTER=true`.
- Test locally in Codex, Claude Code, Cursor, ChatGPT, Gmail, Slack, and terminal flows.
- Enable for Speed mode only.
- Keep Quality mode on current compiler until evals pass.
- Promote to default after latency and acceptance criteria are met.

## 23. Acceptance Criteria

### 23.1 Functional

- Speed mode uses `gpt-5.4-nano` unless overridden by `OPENAI_MODEL_SPEED`.
- Router returns a deterministic decision for every request.
- Router never requires a model call to classify mode or pattern.
- Local fallback exists for every pattern.
- Model input packet is compact in Speed mode.
- Context sources obey user privacy settings.
- Inline mode returns only the rewritten prompt.

### 23.2 Latency

- p50 selected-text-only hotkey-to-paste is under 900 ms.
- p95 selected-text-only hotkey-to-paste is under 1500 ms.
- p95 backend model wait is under 1100 ms.
- Timeout/fallback rate is under 5% in target apps.

### 23.3 Quality

- Correct pattern selection is at least 90% on eval set.
- Unsupported-fact rate is below 1%.
- No-regenerate/no-undo rate is at least 80%.
- Speed output averages under 180 words.
- Coding-agent prompts consistently include inspect/scope/verify guidance.
- Research prompts consistently include source/caveat/date guidance when facts may be current.

### 23.4 Safety and Privacy

- No raw prompt content in default telemetry.
- No disabled context source is sent.
- Clipboard is restored according to existing settings.
- Timeout fallback does not paste stale model output after the user-visible deadline.

## 24. Risks and Mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Local router misclassifies task | Medium | Priority rules, explicit user-selected mode override, eval set |
| Nano rewrite is too weak | Medium | Strong local pattern packet, Quality mode escape hatch, acceptance telemetry |
| Fallback feels generic | Medium | Pattern-specific fallback templates, keep observed context where useful |
| Latency still exceeds 1.5s | High | Shorter model deadline, lower output cap, minified packet, no OCR in Speed |
| Context causes hallucinated details | High | "Observed context" framing, strict no unsupported facts rule |
| Users notice fallback quality drop | Medium | Track fallback rate; show no UI unless failure occurs; optimize network/model path |
| Router knobs make UX complex | Medium | Keep router invisible; expose only Speed/Quality |

## 25. Open Questions

- Should Speed mode paste fallback immediately at 700-900 ms and show model output only in preview mode?
- Should the app expose a "Fastest" sub-mode that uses local fallback only for very common coding-agent prompts?
- Should router decisions be editable in local history for power users?
- Should accepted/regenerated rewrites become local training/eval examples?
- Should target apps have custom pattern overrides, for example Codex vs ChatGPT vs Gmail?

## 26. Launch Recommendation

Build this as a Speed-mode-only upgrade first.

The initial launch target should be:

> Press hotkey on a rough coding-agent prompt and receive a scoped, verified, agent-ready prompt in under 1.5 seconds.

Do not over-expand into all workflows at once. Coding-agent and debugging prompts are the highest-leverage wedge because bad prompts waste the most time there. Once those pass latency and acceptance thresholds, expand the same router pattern to research, extraction, and reply drafting.

## 27. One-Sentence Product Definition

Shakespeare's Latency-Optimized Prompt Router classifies a rough prompt locally, selects the cheapest useful prompt pattern, uses `gpt-5.4-nano` for fast final wording, and falls back deterministically so the user gets a better prompt before the 1.5 second deadline.
