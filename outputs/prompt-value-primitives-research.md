# Prompt Value Primitives Research

Date: 2026-06-16

## Why The Previous Router Felt Underwhelming

The bad rewrite:

```text
Goal: use the mobbin mcp to redesign the electron app UI...
Inspect the relevant files and current behavior first. Keep the change scoped...
```

This is not wrong, but it is low value. A capable coding agent already knows to inspect files and verify work. The prompt did not save meaningful time because it failed to add the missing execution plan specific to the user's task:

- What to do with Mobbin.
- What design evidence to extract.
- Which UI decisions to make before editing.
- What deliverables prove the redesign happened.
- How to visually verify the result.

The core insight:

> A prompt optimizer should not add generic agent etiquette. It should add the missing work contract that the user would otherwise have to explain in follow-up prompts.

## Source-Backed Research Takeaways

### 1. Outcome-first beats process-heavy filler

OpenAI's current prompt guidance says newer models often work better with shorter, outcome-oriented prompts. It explicitly warns against carrying over old prompt stacks that over-specify process, because they can add noise and produce mechanical answers.

Implication for Shakespeare:

- Do not blindly add "inspect, scope, test" to every coding prompt.
- Add only instructions that change the artifact or remove ambiguity.
- Prefer "what good looks like" over generic process.

Source: https://developers.openai.com/api/docs/guides/prompt-guidance

### 2. Tool prompts need explicit action, not tool name preservation

Anthropic's tool-use guidance says models can interpret vague requests as "suggest" rather than "act"; when a tool should be used, prompts need explicit direction to use that tool. OpenAI's prompt engineering docs similarly recommend concrete tool-use examples and workflow guidance for code tasks.

Implication for Shakespeare:

- If the user names a tool, MCP, connector, or reference source, the compiler should create a tool-use contract.
- It should say what to search/query, what to inspect in the result, and how the tool output should inform the final artifact.
- Merely preserving "use Mobbin MCP" is insufficient.

Sources: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices, https://developers.openai.com/api/docs/guides/prompt-engineering

### 3. Context engineering is about token utility, not maximum context

Anthropic frames context engineering as deciding what information should be in the model's state, including tools, MCP, data, and history. The important part is utility under constraints, not dumping everything visible.

Implication for Shakespeare:

- The router should not just pass context; it should decide what role that context plays.
- For a design task, reference screenshots are high utility.
- For a simple coding fix, a current file path or failing diagnostic may be higher utility than broad visible text.

Source: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

### 4. MCP is a workflow surface, not only a tool call

The Model Context Protocol distinguishes tools, resources, and prompts. Tools let models call external systems; prompts provide reusable structured workflows; resources provide contextual data.

Implication for Shakespeare:

- If a user says "use the Mobbin MCP," the optimized prompt should tell the agent whether to call a tool, inspect returned resources/screens, or follow a tool-specific workflow.
- A prompt compiler should preserve explicit tool intent and convert it into steps that the target agent can execute.

Sources: https://modelcontextprotocol.io/specification/2025-03-26/server/tools, https://modelcontextprotocol.io/specification/2025-06-18/server/prompts, https://modelcontextprotocol.io/specification/2025-06-18/server/resources

### 5. Prompt optimization should be evaluated by failure-specific graders

OpenAI's prompt optimizer docs emphasize datasets, annotations, graders, and repeated evaluation. The effectiveness depends on narrowly defined graders for the output properties where the prompt is failing.

Implication for Shakespeare:

- The router should be evaluated by archetype-specific quality checks, not generic "looks better" judgments.
- A UI redesign prompt should be graded on whether it includes reference extraction, concrete visual decisions, implementation scope, and visual verification.
- A research prompt should be graded on source quality, date handling, comparison dimensions, and caveats.

Source: https://developers.openai.com/api/docs/guides/prompt-optimizer

### 6. Structured prompts help separate task, context, constraints, and output

Google's Gemini prompt strategy docs recommend structured prompting with clear separation of role, constraints, context, task, and output format. They also call out the need to balance agent accuracy with latency/tokens for complex agentic workflows.

Implication for Shakespeare:

- Speed mode should use compact structure only where it prevents failure.
- Quality mode can add more structure and self-checking.
- The router should decide the structure by task archetype.

Source: https://ai.google.dev/gemini-api/docs/prompting-strategies

## New Definition Of Optimization

Old definition:

> Make the prompt clearer and more agent-friendly.

Better definition:

> Add the smallest missing work contract that changes the first run's outcome.

The optimized prompt should do at least one of these:

1. Save the user from writing a follow-up.
2. Save the agent from choosing the wrong workflow.
3. Save time by forcing the right tool/reference/source at the start.
4. Prevent a common expensive failure.
5. Make the final artifact verifiable.

If a rewrite does none of these, it is probably prompt-fluff.

## Prompt Value Primitives

These are the actual building blocks Shakespeare should route to.

| Primitive | What It Adds | Saves Time By | Example Trigger |
| --- | --- | --- | --- |
| Tool binding | Specific tool/source and when to use it | Prevents agent ignoring the tool or using it too late | `use Mobbin MCP`, `use Figma`, `search web` |
| Reference extraction | What to extract from references | Turns inspiration into implementable decisions | `like Wispr Flow`, `use examples`, `benchmark` |
| Deliverable contract | Concrete outputs/files/artifacts | Prevents vague completion | `redesign`, `write PRD`, `build dashboard` |
| Acceptance criteria | How to know done | Prevents partial work | `make this better`, `fix`, `polish` |
| Evidence contract | Required sources/citations/data | Prevents stale or hallucinated research | `latest`, `pricing`, `best`, `market` |
| Decision criteria | Options, tradeoffs, recommendation rule | Prevents generic advice | `should I`, `choose`, `best` |
| Schema contract | Exact output shape and missing-value rule | Prevents unusable output | `extract`, `convert`, `JSON`, `table` |
| Reproduction contract | Error, repro path, root cause, exact verification | Prevents symptom patching | `broken`, `failing`, stack trace |
| Audience/tone contract | Recipient, intent, tone, commitment boundaries | Prevents awkward replies | `reply`, `draft email`, `make this sound` |
| Visual verification contract | Screenshot or viewport check | Prevents "changed CSS but UI is bad" | `redesign UI`, `frontend`, `polish` |

## Archetype Router

The router should choose archetypes, not just modes.

### A1. UI Redesign With Reference Tool

Trigger:

- `Mobbin`, `Figma`, `MCP`, `reference`, `inspiration`, `screens`
- plus `UI`, `dashboard`, `Electron app`, `frontend`, `typography`, `colors`, `spacing`, `redesign`, `polish`

Missing work:

- Search references.
- Inspect returned visuals.
- Extract visual decisions.
- Apply to current UI.
- Preserve functionality.
- Verify visually.

Optimized prompt shape:

```text
Redesign the Electron app UI using Mobbin as the reference source.

Use the Mobbin MCP first: search for relevant clean productivity/settings/dashboard screens, inspect the returned visuals, and extract typography, spacing, palette, density, and control patterns. Do not copy proprietary UI exactly.

Then inspect the current Electron renderer/components/styles and implement a scoped redesign inspired by the reference direction. Preserve existing functionality and states.

Deliverables: updated UI code/styles, short design-decision summary with references used, and verification with tests plus a local screenshot or visual check.
```

Why this saves time:

- The agent starts with Mobbin instead of coding immediately.
- The user does not have to follow up with "no, actually use references."
- The final result has visible design criteria.

### A2. Implementation With Product Ambiguity

Trigger:

- `build`, `implement`, `add`, `ship`
- missing target files, acceptance criteria, or UX behavior.

Missing work:

- Infer likely product behavior from current code.
- Identify files before editing.
- Define minimal acceptance criteria.
- Implement the smallest useful slice.

Optimized prompt shape:

```text
Implement {{feature}} in the current repo.

First inspect the existing product flow and nearby components to infer the intended behavior. Before editing, state the smallest implementation slice and acceptance criteria. Then implement that slice, preserve existing behavior, and verify with the closest tests or checks.
```

### A3. Debugging With Evidence

Trigger:

- `failing`, `broken`, `error`, `stack trace`, `flaky`, `why`.

Missing work:

- Repro/evidence capture.
- Root cause before fix.
- Exact failing-path verification.

Optimized prompt shape:

```text
Investigate the observed failure.

Use the provided error/log/context as evidence. Reproduce or inspect the failing path, identify root cause before editing, apply the narrowest fix, and verify against the exact failure or closest available check. Summarize cause, fix, and verification.
```

### A4. Research With Current Facts

Trigger:

- `best`, `latest`, `pricing`, `competitor`, `market`, `compare`.

Missing work:

- Source quality.
- Date handling.
- Comparison dimensions.
- Caveat policy.

Optimized prompt shape:

```text
Research {{question}}.

Use current primary sources for time-sensitive claims. Compare options across explicit dimensions, include dates for volatile facts, separate evidence from interpretation, and end with a recommendation plus caveats.
```

### A5. Extraction Into Usable Data

Trigger:

- `extract`, `parse`, `convert`, `JSON`, `CSV`, `table`.

Missing work:

- Schema.
- Missing-value handling.
- No-inference rule.

Optimized prompt shape:

```text
Convert the input into {{format}}.

Follow this schema exactly: {{schema or infer minimal schema from request}}. Preserve source meaning, use null for missing values, do not infer unsupported fields, and return only the structured output.
```

### A6. Decision/Recommendation

Trigger:

- `should I`, `choose`, `recommend`, `which`, `tradeoff`.

Missing work:

- Criteria.
- Constraints.
- What would change the answer.

Optimized prompt shape:

```text
Help decide {{decision}}.

Clarify the options, compare them against the decision criteria that matter here, state assumptions, recommend one path, and say what new information would change the recommendation.
```

### A7. Reply/Draft

Trigger:

- `reply`, `draft`, `respond`, `email`, `Slack`.

Missing work:

- Audience.
- Intent.
- Tone.
- Commitment boundaries.

Optimized prompt shape:

```text
Draft a reply to {{audience/context}}.

Intent: {{intent}}. Tone: {{tone if known, otherwise infer conservative professional}}. Avoid inventing commitments or facts not in the context. Return only the reply.
```

## What Shakespeare Should Stop Doing

Avoid generic filler unless the task specifically needs it:

- "Be clear and concise."
- "Inspect relevant files."
- "Keep the change scoped."
- "Run relevant tests."
- "Summarize what changed."

Those can be useful, but they are not enough. For coding agents, they are table stakes. They should appear only when no higher-value primitive applies, or as the final one-line verification tail after the real work contract.

## Updated Router Rule

The router should rank candidate primitives by expected time saved:

```text
1. Explicit tool/reference/source requested? Add tool binding + extraction contract.
2. Artifact/design/build requested? Add deliverable + acceptance contract.
3. Current/external facts requested? Add evidence/source/date contract.
4. Structured data requested? Add schema + missing-value contract.
5. Debugging requested? Add repro/root-cause/verification contract.
6. Reply/writing requested? Add audience/tone/commitment contract.
7. Otherwise add only minimal clarity and output shape.
```

This preserves speed while making rewrites materially more useful.

## Evaluation Changes

Add archetype-specific graders:

| Archetype | Required Signals |
| --- | --- |
| UI redesign with reference tool | tool use first, reference extraction, visual decisions, implementation target, visual verification |
| Implementation | product behavior, acceptance criteria, scoped implementation, verification target |
| Debugging | evidence, root cause, narrow fix, exact verification |
| Research | current/primary sources, dates, dimensions, caveats |
| Extraction | schema, null policy, no inference, output only |
| Decision | criteria, options, recommendation, assumption boundary |
| Reply | audience, tone, no invented commitments, output only |

For each eval fixture, ask:

> Would this rewrite have prevented the most likely expensive follow-up?

If no, it is not optimized enough.

