# Prompt Optimization Research Brief

Date: 2026-06-16

Project context: Shakespeare is an inline prompt compiler. The product does not need the most theoretically powerful prompt optimizer on every hotkey press. It needs the fastest reliable way to choose the smallest prompt transformation that prevents the most likely failure.

## Executive Conclusion

The best instant prompt optimizer is a **decision router**, not a mega-prompt.

For Shakespeare, the core algorithm should be:

1. Infer the target workflow.
2. Diagnose the likely failure mode of the rough prompt.
3. Add only the cheapest technique that directly reduces that failure mode.
4. Preserve intent and label observed context conservatively.
5. Stop before the prompt becomes a prompt-engineering museum.

The research points to a clean split:

- **Instant optimization**: one model call, short stable compiler instructions, task classification, slot filling, technique routing, and a final compression/safety pass.
- **Offline optimization**: dataset-backed eval loops, prompt search, textual gradients, self-refinement, or DSPy-style compilation. These work, but they are not appropriate for a 1 to 2 second inline hotkey unless they run in the background.

The winning product move is therefore not "make every prompt more detailed." It is **choose the right prompt pattern immediately**.

## The Core Algorithm

Call this the **Prompt Optimization Router**.

```text
optimize(draft, context, target, latency_budget):
  1. Normalize intent
     - Extract the user's actual task.
     - Preserve wording when it carries preferences.
     - Remove emotional pressure, filler, and vague intensifiers.

  2. Classify workflow
     - coding_agent
     - debugging
     - research
     - extraction_or_transformation
     - writing_or_reply
     - decision_or_advice
     - creative_generation
     - general_question

  3. Diagnose missing control surfaces
     - goal
     - context
     - constraints
     - success criteria
     - output format
     - tool/source requirements
     - verification requirement
     - uncertainty policy
     - examples or style reference

  4. Predict likely failure mode
     - too vague
     - wrong scope
     - missing context
     - wrong output shape
     - hallucinated facts
     - overbuilt agent behavior
     - underbuilt agent behavior
     - weak reasoning/decomposition
     - style/tone mismatch
     - parsing/automation mismatch

  5. Select the cheapest useful technique
     - slot fill for most prompts
     - few-shot only when format/style/class labels matter and examples exist
     - plan/decompose only for multi-step work
     - tool/source instructions only when external truth is required
     - verification only when correctness matters
     - self-check only in quality or high-risk modes
     - iterative/eval optimization only offline

  6. Compile final prompt
     - target-specific structure
     - observed context block if useful
     - constraints and success criteria
     - output contract
     - "ask only if blocked" or "state assumptions" policy

  7. Safety and compression pass
     - remove unsupported facts
     - remove conflicting instructions
     - remove redundant prompt-engineering boilerplate
     - keep speed-mode output short
```

The one-line version:

> Classify the task, identify the prompt's most expensive likely failure, apply the smallest technique that prevents that failure, then compress.

## Technique Router

| Signal in rough prompt or context | Most likely failure | Fastest useful transformation | Avoid in Speed mode |
| --- | --- | --- | --- |
| "fix this", "make it work", "bug" inside terminal/editor | Agent edits randomly or overbuilds | Coding-agent scaffold: inspect, root cause, narrow fix, verify, summarize | Long architecture lecture |
| Stack trace, failing test, error text visible | Symptom patching | Debug scaffold: reproduce, isolate cause, fix narrowly, verify exact failure | Generic "think step by step" |
| "research", "compare", "best", "latest" | Shallow answer or stale facts | Research scaffold: scope, source requirements, comparison dimensions, caveats, dated claims | Asking for sources when no browsing/tool access exists |
| "summarize this" with selected/visible text | Missing context or wrong format | Context injection plus explicit output shape | Unneeded role/persona |
| Needs a table, JSON, CSV, code block, labels | Unparseable output | Format contract plus one tiny example if available | Complex reasoning prompt |
| Needs tone/style match | Tone drift | Role/audience/tone plus example or style constraints | Abstract adjectives only |
| Many subgoals or ambiguous order | Missed steps | Plan/decompose instruction and completion criteria | Full chain-of-thought transcript |
| External/current facts required | Hallucination | Tool/source/citation instruction; clarify if no tool available | Confident answer without provenance |
| High-stakes/legal/medical/financial | Unsafe certainty | Uncertainty policy, verification, cite source, recommend expert review | "Be decisive" style pressure |
| Repeated production task with eval data | Local optimum from one prompt | Offline optimizer: evals, annotations, candidate search | Inline multi-run optimization |
| User asks for "quick" or app is inline hotkey | Latency breaks habit | Single call, short output, no examples unless given | Self-consistency, multi-agent loops |

## Prompt Quality Slots

Almost every high-quality prompt is some subset of these slots:

```text
TASK: What should the model do?
CONTEXT: What facts/input should it use?
TARGET: Who/what is the output for?
CONSTRAINTS: What must or must not happen?
METHOD: What process is required only if process matters?
TOOLS/SOURCES: What should be inspected, searched, cited, or executed?
OUTPUT: What shape should the final answer take?
SUCCESS: What counts as done?
UNCERTAINTY: What to do when information is missing or ambiguous?
```

Speed mode should fill only missing slots that matter. Quality mode can fill more slots and add a self-check.

## What The Research Says

### 1. Prompting is a toolbox, not a single trick

The Prompt Report organizes prompt engineering into a large taxonomy: 58 text-only LLM prompting techniques and 40 techniques for other modalities. The practical lesson for Shakespeare is that a generic "enhance this prompt" transformation is underspecified. The optimizer must first route to a technique family.

Source: [The Prompt Report](https://arxiv.org/abs/2406.06608)

### 2. Clear instructions, context separation, examples, and output format are the durable basics

OpenAI's prompt engineering docs emphasize beginning with instructions, separating input/context from instructions, being specific about desired outcome and format, and showing format through examples when needed. Google Gemini docs similarly emphasize clear instructions, context, system instructions, structured prompts, few-shot examples, reasoning/decomposition, and iteration. Anthropic's Claude docs emphasize clear direct instructions, examples, XML/structured separation, thinking only when useful, and agentic systems guidance.

Sources: [OpenAI best practices](https://help.openai.com/en/articles/6654000-best-practices-for-prompt-engineering-with-openai-api), [Google prompt design strategies](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/prompts/prompt-design-strategies), [Anthropic prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)

### 3. Agentic prompts need autonomy controls

OpenAI's GPT-4.1 and GPT-5 guidance highlights persistence, tool use, planning, context gathering boundaries, and explicit stop conditions for agentic workflows. This maps directly onto Shakespeare's coding-agent mode. The prompt should not merely ask for a better answer; it should calibrate the agent's behavior: inspect before editing, avoid unrelated work, verify, and know when to stop.

Source: [OpenAI GPT-4.1 prompting guide](https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide), [OpenAI prompt guidance](https://developers.openai.com/api/docs/guides/prompt-guidance)

### 4. Reasoning techniques help only when the task needs reasoning

Chain-of-thought, plan-and-solve, least-to-most, ReAct, and self-consistency all have evidence for reasoning or agent tasks. But they add tokens, latency, and sometimes unnecessary verbosity. For Shakespeare, they should be gated:

- Use **plan/decompose** for multi-step tasks, debugging, research, and agentic execution.
- Use **ReAct-style tool/source instructions** when external information or environment interaction is required.
- Use **self-consistency or multiple candidates** only in Max Quality or offline eval mode.
- Do not add reasoning scaffolds to simple extraction, rewrite, reply, or formatting tasks.

Sources: [Chain-of-Thought](https://arxiv.org/abs/2201.11903), [Plan-and-Solve](https://arxiv.org/abs/2305.04091), [ReAct](https://arxiv.org/abs/2210.03629), [Self-Consistency](https://arxiv.org/abs/2203.11171)

### 5. Automatic prompt optimization works, but it is usually eval-bound

APE, OPRO, ProTeGi, Promptbreeder, TextGrad, and DSPy all support the same deeper point: prompt optimization becomes much more powerful when there is a score function, examples, feedback, or test cases. That makes them excellent for improving Shakespeare's compiler prompt over time, not for every inline rewrite.

Sources: [APE](https://arxiv.org/abs/2211.01910), [OPRO](https://arxiv.org/abs/2309.03409), [ProTeGi](https://aclanthology.org/2023.emnlp-main.494/), [Promptbreeder](https://arxiv.org/abs/2309.16797), [TextGrad](https://arxiv.org/abs/2406.07496), [DSPy](https://arxiv.org/abs/2310.03714)

### 6. Fast prompt optimization is mostly prompt architecture and latency discipline

OpenAI and Anthropic both document prompt caching patterns: keep static instructions, examples, tools, and reusable context at the beginning; put dynamic inputs later. OpenAI docs also note that exact prefix matches matter for caching. That reinforces Shakespeare's current architecture: stable short compiler instructions plus dynamic JSON input.

Sources: [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching), [Anthropic prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)

### 7. System prompts are powerful but not magic

System prompts are a major behavior-control surface, but robustness research shows models can still fail under conflicts or adversarial user input. For Shakespeare, this means the compiler should avoid creating prompts that rely only on "never do X" safety language. It should produce unambiguous, non-conflicting, scoped instructions.

Source: [A Closer Look at System Prompt Robustness](https://arxiv.org/abs/2502.12197)

## Good System Prompt Patterns

These are not copy-paste examples; they are patterns worth compiling toward.

### Coding Agent

```text
You are working in the user's current codebase.

Goal: {{user_goal}}

Use the provided context as observed context, not guaranteed truth:
{{context}}

First inspect the relevant files and current behavior. Make the smallest change that solves the issue. Avoid unrelated refactors. Run the most relevant tests or checks, or explain why they cannot be run.

Return a concise final summary with cause, changed files, and verification.
```

Why it works: it sets role, scope, process, verification, and final output. It mirrors the strongest patterns in OpenAI's agentic guidance and Codex-style system instructions.

### Debugging

```text
Investigate and fix this issue:
{{rough_prompt}}

Observed context:
{{error_or_visible_context}}

Find the root cause before editing. Prefer the narrowest fix that addresses the failing behavior. Verify against the specific error, failing test, or reproduction path. If the context is insufficient, state the missing information and the most likely next check.
```

Why it works: it prevents symptom patching and anchors verification to the observed failure.

### Research

```text
Research question:
{{rough_prompt}}

Scope:
{{scope_or_inferred_scope}}

Use current, primary sources when facts may have changed. Compare the strongest options across {{dimensions}}. Separate confirmed facts from interpretation. Include caveats and dates for time-sensitive claims.

Output:
{{format}}
```

Why it works: it encodes source quality, comparison dimensions, and caveat handling, which are the common failure points in broad research prompts.

### Extraction Or Transformation

```text
Transform the input into {{output_format}}.

Rules:
- Preserve all factual content.
- Do not infer missing fields.
- Use null for unavailable values.
- Follow the schema exactly.

Input:
{{input}}
```

Why it works: examples are optional if the schema is strict; if the output style is subtle, add one example.

### Writing Or Reply

```text
Draft a {{format}} for {{audience}}.

Intent:
{{rough_prompt}}

Context:
{{context}}

Tone:
{{tone}}

Constraints:
{{constraints}}

Return only the draft.
```

Why it works: style tasks need audience and tone more than reasoning instructions.

## Speed vs Quality Policy

### Speed Mode

Use when the user wants inline replacement and habit-forming latency.

- One model call.
- Stable, cache-friendly compiler instruction.
- Dynamic data in a compact JSON packet.
- No web search.
- No screenshot/OCR unless explicitly enabled.
- No self-consistency.
- No generated examples unless the user/context already includes examples.
- Output target: usually 80 to 220 words, with a hard ceiling near the current 450 output token setting.

### Quality Mode

Use when the prompt is high-value, ambiguous, multi-step, or likely to fail if under-specified.

- Still prefer one model call.
- Add an internal critique checklist in the instruction.
- Allow more complete output structure.
- Add a short self-check instruction for correctness, unsupported facts, conflicts, and output shape.
- Use more context if enabled.

### Max Quality / Offline

Use only outside the hotkey path or when the user explicitly accepts slower work.

- Generate multiple candidate prompts and score them.
- Use user acceptance/regenerate/revert data as weak labels.
- Maintain eval sets for task types.
- Run APE/OPRO/ProTeGi/DSPy-style optimization on the compiler prompt and mode templates.
- Ship template revisions only after evals and manual review.

## The Shakespeare-Specific Recommendation

The current compiler already has the right foundation:

- Short stable instructions.
- Mode-specific guidance.
- Dynamic JSON input.
- Speed and quality model routing.
- Local fallback templates.
- Conservative context usage.

The highest-leverage next step is to upgrade the compiler from "mode guidance" to a **mode plus failure-router**.

Implementation shape:

```text
System instruction:
  You are a prompt compiler.
  Preserve intent.
  Use observed context conservatively.
  Diagnose the likely failure mode.
  Choose the smallest useful prompt pattern.
  Return only the compiled prompt.

Dynamic input:
  rough_prompt
  mode
  optimization_mode
  target_app
  context

Internal routing:
  if coding_agent -> inspect/scope/verify/final-summary
  if debugging -> root-cause/repro/narrow-fix/verify
  if research -> scope/source-quality/comparison/caveats/output
  if extraction -> schema/preserve/no-infer
  if writing -> audience/tone/format
  if ambiguous -> assume when safe, ask only if blocked
```

The compiler should explicitly avoid adding:

- Unsupported file names, errors, APIs, or product facts.
- Generic roles that do not change behavior.
- Chain-of-thought prompts for simple tasks.
- Long few-shot examples in speed mode.
- Conflicting "be concise but exhaustive" style instructions.
- Emotional pressure or "this is very important" hacks.

## Better Compiler Instruction Draft

This is the strongest short system prompt candidate for Shakespeare's backend:

```text
You are Shakespeare, a prompt compiler for LLMs and coding agents.

Rewrite the rough request into the smallest prompt that is likely to succeed.
Preserve the user's intent and wording where it matters. Do not add unsupported facts, filenames, errors, preferences, or constraints.

Use context only when it clearly helps. Treat app, window, browser, clipboard, and screen text as observed context, not guaranteed truth.

Before writing the final prompt, silently classify the workflow and likely failure mode. Choose only the prompt techniques that address that failure mode:
- coding/debugging: inspect first, narrow scope, root cause, verify, summarize
- research: scope, source standards, comparison dimensions, caveats, output format
- extraction/transformation: exact schema, preserve input, do not infer missing data
- writing/reply: audience, tone, intent, constraints, final format
- complex multi-step tasks: plan/decompose and define done
- high-risk factual tasks: uncertainty and verification rules

Speed mode: be concise and avoid examples unless provided.
Quality mode: add structure and a brief self-check when it materially improves success.

Return only the rewritten prompt. No preamble, no markdown fence, no explanation.
```

This keeps the stable prefix short enough for speed while encoding the actual algorithm.

## Evaluation Plan

Prompt optimization should be measured by reduced reprompting, not by whether the generated prompt "looks impressive."

Recommended eval set:

- 20 coding-agent rough prompts.
- 20 debugging prompts with visible errors.
- 20 research prompts.
- 20 summarization/extraction prompts.
- 20 writing/reply prompts.
- 10 adversarial/ambiguous prompts where the compiler must not invent facts.

Scoring dimensions:

- Intent preservation.
- Unsupported-fact rate.
- Scope control.
- Output contract clarity.
- Correct technique choice.
- Prompt length.
- Latency.
- Human acceptance/no-regenerate rate.

Product telemetry to collect locally or privacy-safely:

- Accept vs regenerate.
- Undo/revert after replacement.
- Mode used.
- Latency.
- Prompt length delta.
- Context sources used.
- Optional thumbs-up/down.
- No raw prompt content unless local history is explicitly enabled.

## Practical Product Thesis

Shakespeare wins if it feels like this:

> I type what I mean badly. Shakespeare instantly turns it into the prompt I would have written if I had paused for 90 seconds.

That means the optimizer should behave less like a prompt guru and more like a compiler:

- infer intent,
- select target pattern,
- bind context,
- enforce constraints,
- emit clean instructions,
- do it fast.

The central algorithm is therefore **technique selection under latency**, not prompt expansion.

