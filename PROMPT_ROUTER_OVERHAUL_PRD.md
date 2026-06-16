# Prompt Router Overhaul PRD

Date: 2026-06-16

## 1. Summary

The Prompt Router Overhaul replaces Shakespeare's generic "make this prompt clearer" behavior with an archetype-based router that optimizes prompts by adding the smallest missing work contract.

The central product shift:

> Shakespeare should not make prompts sound more professional. It should make the first AI run materially less likely to waste time.

The current router already supports latency-aware routing and a `ui_redesign` pattern, but the deeper product should generalize that approach across the major prompt categories people actually use: writing, practical guidance, information seeking, decision support, coding, research, extraction, learning, marketing, job/career work, creative generation, and tool/reference workflows.

## 2. Why This Overhaul Exists

The previous router produced an underwhelming rewrite for:

```text
use the mobbin mcp to redesign the electron app UI to be like whisper flow style of clean typography and colors
```

It generated generic coding-agent hygiene:

```text
Inspect the relevant files and current behavior first.
Keep the change scoped.
Verify with tests.
```

That is table stakes. It did not tell the agent:

- How to use Mobbin.
- What references to search for.
- What to extract from those references.
- What visual decisions to make.
- What implementation artifacts to modify.
- What visual proof should count as done.

The fix was not "write a longer prompt." The fix was to detect that this was a **UI redesign with reference tool** archetype and add the missing reference-to-implementation contract.

This PRD expands that idea into the full routing system.

## 3. Research Basis

### 3.1 Actual ChatGPT Usage Clusters

OpenAI's 2025 usage study says three-quarters of consumer ChatGPT conversations focus on practical guidance, seeking information, and writing. It also frames usage as Asking, Doing, and Expressing: about half of messages are Asking, 40% are Doing, and 11% are Expressing. The study says writing is the most common work task, while coding and self-expression remain niche activities.

Source: https://openai.com/index/how-people-are-using-chatgpt/

Implication:

Shakespeare cannot optimize only for coding prompts. The router needs strong patterns for:

- Practical guidance.
- Seeking information.
- Writing/editing.
- Decision support.
- Task execution.

### 3.2 Prompt Libraries Reveal Repeated Workflows

AIPRM says its product has 4500+ prompt templates and more than 2 million users, with prompt libraries for marketing, sales, copywriting, SEO, productivity, customer support, and more. Its prompt statistics page says writing-based prompts dominate among AIPRM users; roughly 80% of the top 10 most-used AIPRM prompts list writing as a function.

Sources: https://chromewebstore.google.com/detail/aiprm-for-chatgpt/ojnbohmppadfgpejeebfnmnknjdlckgj, https://www.aiprm.com/chatgpt-statistics/

Implication:

Popular prompts are often reusable work packages, not one-off wording. The router should create compact versions of those work packages dynamically.

### 3.3 Community Prompt Categories Are Broad

An analysis of FlowGPT agents collected 165 agents across 11 default categories: Image Generation, Character, Prompt Engineering, Creative, Programming, Game, Academic, Job Hunting, Productivity, Marketing, and Business.

Source: https://arxiv.org/html/2408.00512v1

Implication:

Router archetypes should cover broad user intent categories, not just developer tasks.

### 3.4 Prompt Collections Show Role/Task Templates Are Common

The `prompts.chat` project describes itself as a curated collection of prompt examples for AI chat models and exposes prompts in reusable data formats. This pattern confirms that many user prompts can be understood as reusable archetypes.

Source: https://github.com/f/prompts.chat

Implication:

The router should route to archetypes plus slots, not fixed static templates.

### 3.5 Official Guidance Favors Outcome-First Prompting

OpenAI's current prompt guidance says newer models often work best with shorter, outcome-oriented prompts: describe what good looks like, what constraints matter, what evidence is available, and what final answer should contain. It warns that legacy prompt stacks can add noise and produce mechanical answers.

Source: https://developers.openai.com/api/docs/guides/prompt-guidance

Implication:

The router should not pile on every best practice. It should add the missing contract that changes the output.

### 3.6 Tool Use Needs Explicit Workflow

OpenAI prompt engineering docs recommend clear workflow and tool-use examples for coding/tool tasks. Anthropic's prompting docs note that if a tool should be used, the prompt must be explicit enough that the model acts rather than merely suggests.

Sources: https://developers.openai.com/api/docs/guides/prompt-engineering, https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices

Implication:

When a prompt names a tool, reference source, MCP, app, dataset, or connector, the router should bind that tool to a concrete action.

## 4. Core Thesis

The same style of thinking applies to almost every prompt, but the primitive changes.

The general algorithm:

```text
1. Classify what work the user is trying to delegate.
2. Identify the likely expensive failure.
3. Add the smallest missing contract that prevents that failure.
4. Preserve intent and context.
5. Keep latency and output length under the Speed budget.
```

The missing contract is not always "inspect files and test."

Examples:

- Writing prompt: missing audience, tone, channel, and success criterion.
- Research prompt: missing source/date/caveat contract.
- Decision prompt: missing options, criteria, tradeoff rule, and recommendation format.
- Extraction prompt: missing schema and null policy.
- Learning prompt: missing learner level, misconception check, practice loop.
- UI redesign prompt: missing reference extraction and visual verification.
- Marketing prompt: missing audience, offer, brand voice, channel, CTA, compliance guardrails.
- Career prompt: missing target role, resume constraints, no-fabrication rule.

## 5. Product Definition

Prompt Router Overhaul is a Speed-compatible prompt compiler that converts rough user asks into archetype-specific work contracts.

It must:

- Route prompts to high-leverage archetypes.
- Add only the missing contract for that archetype.
- Avoid generic fluff.
- Preserve explicit tool/source/reference intent.
- Remain fast enough for inline replacement.
- Provide deterministic fallbacks when the model is unavailable.
- Support evals that measure prevented follow-ups, not just nicer wording.

## 6. Non-Goals

The router is not:

- A full agent.
- A prompt marketplace.
- A multi-step optimizer in Speed mode.
- A long prompt generator.
- A chain-of-thought scaffold.
- A product that writes every possible custom workflow from scratch.

It is a fast work-contract compiler.

## 7. Prompt Value Primitives

| Primitive | Adds | Prevents |
| --- | --- | --- |
| Tool binding | Required tool/source and action timing | Agent ignores named tool or uses it too late |
| Reference extraction | What to extract from examples | Vague "inspired by" output |
| Evidence contract | Source quality, dates, citations, caveats | Stale or hallucinated claims |
| Decision contract | Options, criteria, tradeoffs, recommendation rule | Generic advice |
| Deliverable contract | Concrete artifacts/files/sections expected | Vague completion |
| Acceptance contract | What done means | Partial or unfalsifiable work |
| Schema contract | Fields, format, null policy, no-inference rule | Unusable structured output |
| Fidelity contract | Preserve meaning, translate/summarize without distortion | Over-compression or invention |
| Audience/tone contract | Recipient, voice, channel, boundaries | Awkward or off-brand writing |
| Learning contract | Level, explanation style, exercises, checks | Passive explanation without learning |
| Reproduction contract | Error evidence, repro path, root cause, exact verification | Symptom patching |
| Visual verification contract | Screenshot/viewport/design check | UI code changes that look bad |
| Safety/uncertainty contract | When to caveat, ask, or defer | Overconfident high-stakes output |

## 8. Popular Prompt Archetypes

### A1. Writing And Editing

Common examples:

- Rewrite this.
- Make this sound better.
- Draft an email.
- Write a blog post.
- Make this more professional.

Likely failure:

- The model improves wording but misses audience, channel, voice, length, or intended action.

Work-saving contract:

- Audience.
- Channel.
- Tone.
- Desired action.
- Length.
- Constraints.
- What not to invent.

Speed prompt shape:

```text
Rewrite/draft {{artifact}} for {{audience}} in {{channel}}.
Preserve the user's intent and facts. Use a {{tone}} tone. Optimize for {{desired_action}}. Do not invent commitments or details. Return only {{format}}.
```

### A2. Practical Guidance / How-To

Common examples:

- How do I do this?
- Make me a plan.
- Help me figure this out.
- What should I do next?

Likely failure:

- Generic advice that ignores constraints, resources, timeline, and risk.

Work-saving contract:

- Goal.
- Current situation.
- Constraints.
- Step sequence.
- Decision points.
- Risk/safety caveat.
- First action.

Speed prompt shape:

```text
Create a practical plan for {{goal}}.
Use the user's current situation and constraints. Prioritize the next 3-5 actions, call out risks or assumptions, and end with the first concrete step.
```

### A3. Seeking Information / Research

Common examples:

- Research this.
- Find the best option.
- What is the latest?
- Compare these tools.

Likely failure:

- Stale facts, weak sources, no dimensions, no caveats.

Work-saving contract:

- Scope.
- Source quality.
- Date handling.
- Comparison dimensions.
- Caveats.
- Recommendation or summary format.

Speed prompt shape:

```text
Research {{question}}.
Use current primary sources for volatile claims. Compare across {{dimensions}}. Include dates, caveats, and separate evidence from interpretation. End with {{output_format}}.
```

### A4. Decision Support

Common examples:

- Should I do A or B?
- Which option is best?
- Recommend the best path.
- Help me decide.

Likely failure:

- Balanced but useless pros/cons with no recommendation.

Work-saving contract:

- Options.
- Criteria.
- Constraints.
- Tradeoff weighting.
- Recommendation.
- What would change the answer.

Speed prompt shape:

```text
Help decide between {{options}}.
Compare them against {{criteria}} and the user's constraints. Recommend one path, explain the tradeoff, and state what new information would change the recommendation.
```

### A5. Coding / Implementation

Common examples:

- Fix this.
- Implement this feature.
- Refactor this.
- Add tests.
- Build this UI.

Likely failure:

- Wrong scope, wrong files, overbuilding, no acceptance criteria.

Work-saving contract:

- Goal.
- Product behavior.
- Scope boundary.
- Target surfaces.
- Acceptance criteria.
- Verification.

Speed prompt shape:

```text
Implement {{goal}} in the current repo.
First inspect the existing product flow and nearby code to infer intended behavior. Define the smallest useful implementation slice and acceptance criteria, then implement it without unrelated refactors. Verify with the closest tests/checks and summarize changed files.
```

### A6. Debugging

Common examples:

- Why is this broken?
- Debug this error.
- Fix failing test.
- Investigate stack trace.

Likely failure:

- Symptom patching or generic debugging advice.

Work-saving contract:

- Observed failure.
- Reproduction path.
- Evidence.
- Root cause before fix.
- Narrow fix.
- Exact verification.

Speed prompt shape:

```text
Investigate the observed failure: {{failure}}.
Use the provided logs/context as evidence. Reproduce or inspect the failing path, identify root cause before editing, apply the narrowest fix, and verify against the exact failure or closest check.
```

### A7. Extraction / Transformation

Common examples:

- Extract this into JSON.
- Make a table.
- Parse these notes.
- Convert this into CSV.

Likely failure:

- Unstable shape, invented fields, missing-value ambiguity.

Work-saving contract:

- Schema.
- Field definitions.
- Missing-value policy.
- No-inference rule.
- Output only.

Speed prompt shape:

```text
Transform the input into {{format}} with schema {{schema}}.
Preserve source meaning. Use null for missing values. Do not infer unsupported fields. Return only the structured output.
```

### A8. Summarization / Translation

Common examples:

- Summarize this.
- Translate this.
- Explain the main point.
- Condense this for me.

Likely failure:

- Wrong compression level, lost nuance, wrong audience.

Work-saving contract:

- Audience.
- Desired length.
- Fidelity level.
- Important details to preserve.
- Output format.

Speed prompt shape:

```text
Summarize/translate {{input}} for {{audience}}.
Preserve key facts, nuance, and named entities. Use {{length_or_format}}. Do not add outside information.
```

### A9. Learning / Tutoring

Common examples:

- Teach me this.
- Explain like I am smart but new.
- Help me study.
- Quiz me.

Likely failure:

- Passive explanation with no diagnosis or practice.

Work-saving contract:

- Learner level.
- Explanation style.
- Examples.
- Misconception checks.
- Practice loop.

Speed prompt shape:

```text
Teach {{topic}} to someone at {{level}}.
Start with the mental model, use one concrete example, avoid unnecessary jargon, then give 2-3 practice questions and check for likely misconceptions.
```

### A10. Marketing / Sales / SEO

Common examples:

- Write landing page copy.
- Create social posts.
- Generate SEO article.
- Draft sales email.
- Make ad variations.

Likely failure:

- Generic copy, no audience/offer/channel/CTA, false claims.

Work-saving contract:

- Audience.
- Offer.
- Channel.
- Funnel stage.
- Brand voice.
- CTA.
- Proof/claims policy.

Speed prompt shape:

```text
Create {{marketing_artifact}} for {{audience}} and {{offer}}.
Optimize for {{channel}} and {{funnel_stage}}. Use {{brand_voice}}. Include a clear CTA. Do not invent claims, metrics, testimonials, or guarantees.
```

### A11. Job / Career

Common examples:

- Write my resume bullet.
- Draft cover letter.
- Prep me for interview.
- Optimize LinkedIn.

Likely failure:

- Generic career advice or fabricated experience.

Work-saving contract:

- Target role.
- Company/job description.
- User evidence.
- Format.
- No-fabrication rule.
- STAR/interview framing when relevant.

Speed prompt shape:

```text
Create {{career_artifact}} for {{target_role}}.
Use only the user's provided experience as evidence. Tailor to the role/company, avoid fabricating credentials, and return {{format}}.
```

### A12. Creative / Brainstorming

Common examples:

- Brainstorm names.
- Give me ideas.
- Create concepts.
- Write a story.

Likely failure:

- Bland first-pass ideas.

Work-saving contract:

- Number of options.
- Diversity axes.
- Style boundaries.
- Selection criteria.
- Optional ranking.

Speed prompt shape:

```text
Generate {{count}} ideas for {{goal}}.
Vary them across {{diversity_axes}}. Stay within {{style_constraints}}. Include a one-line rationale and mark the strongest 2-3 options.
```

### A13. Image / Visual Prompt Generation

Common examples:

- Make an image prompt.
- Generate Midjourney prompt.
- Create illustration prompt.

Likely failure:

- Vague visual direction or too many contradictory style words.

Work-saving contract:

- Subject.
- Composition.
- Medium.
- Style.
- Lighting/color.
- Constraints/negative space.
- Output-ready prompt.

Speed prompt shape:

```text
Create an image-generation prompt for {{subject}}.
Specify composition, medium, style, color/light, key details, and constraints. Avoid contradictory style instructions. Return one clean prompt plus optional negative constraints.
```

### A14. Tool / Reference Workflow

Common examples:

- Use Mobbin MCP.
- Use Figma.
- Use web search.
- Use this dataset.
- Use the browser.

Likely failure:

- Agent mentions the tool but does not use it, or uses it without extracting decisions.

Work-saving contract:

- Tool first or tool when needed.
- Query/action to run.
- What to inspect.
- What to extract.
- How extracted evidence informs the final artifact.

Speed prompt shape:

```text
Use {{tool}} as the required reference/source for {{task}}.
First {{tool_action}}. Inspect the result for {{extraction_targets}}. Then use those findings to produce {{deliverable}}. Cite or summarize the references used when relevant.
```

### A15. UI Redesign With Reference Tool

This is the current Mobbin example.

Trigger:

- UI/frontend/design surface plus reference/tool language.

Work-saving contract:

- Search references.
- Inspect visuals.
- Extract typography, spacing, palette, density, controls.
- Apply to current UI.
- Preserve behavior.
- Verify visually.

Speed prompt shape:

```text
Redesign {{ui_surface}} using {{reference_tool}} as the reference source.
Use {{reference_tool}} first: search for relevant screens/sections, inspect returned visuals, and extract typography, spacing, palette, density, and control patterns. Do not copy proprietary UI exactly.
Then inspect current renderer/components/styles and implement a scoped redesign that preserves behavior.
Deliverables: updated UI code/styles, design-decision summary with references used, and tests plus screenshot/visual check.
```

## 9. Does This Apply To Everything?

Yes, at the meta-level.

No, at the template level.

The universal principle is:

> Optimize by adding the missing contract that prevents the most expensive likely failure.

The specific contract changes by archetype.

For example:

- Research needs evidence.
- Writing needs audience and tone.
- Coding needs scope and acceptance.
- Design needs references and visual criteria.
- Extraction needs schema.
- Decisions need criteria.
- Learning needs level and practice.
- Marketing needs audience, offer, and CTA.

This means Shakespeare should not have one "better prompt" template. It needs an archetype router.

## 10. Router Decision Pipeline

```text
1. Detect target environment
   - Codex, Claude Code, Cursor, ChatGPT, Claude, Gmail, Slack, browser, IDE, terminal.

2. Detect primary work type
   - asking, doing, expressing.
   - writing, research, decision, coding, debug, extraction, learning, marketing, creative, tool workflow.

3. Detect explicit assets
   - tool names, files, URLs, app names, selected text, visible context, reference sources.

4. Detect likely expensive failure
   - ignored tool, stale facts, generic advice, wrong tone, no schema, overbuild, no verification.

5. Choose value primitive
   - tool binding, evidence contract, audience contract, schema contract, etc.

6. Compile compact prompt
   - preserve user wording.
   - add only the selected contract.
   - return artifact-ready prompt.

7. Evaluate against archetype grader
   - did it prevent the likely follow-up?
```

## 11. Pattern Priority

When multiple patterns match, choose the highest time-saved primitive.

Priority order:

1. Safety/high-stakes uncertainty contract.
2. Explicit tool/source/reference binding.
3. External/current fact evidence contract.
4. Artifact deliverable/acceptance contract.
5. Schema/fidelity contract.
6. Decision criteria contract.
7. Audience/tone contract.
8. Generic clarity contract.

Example:

```text
use Mobbin MCP to redesign the Electron app UI
```

This contains coding, design, and tool signals. The winning primitive is not generic coding. It is explicit tool/reference workflow.

## 12. Speed Mode Requirements

Speed mode must remain fast:

- One model call.
- Local routing.
- Pattern packet, not long system prompt.
- Output under roughly 180-250 words for most archetypes.
- Larger cap only for complex archetypes like research, decisions, or UI redesign.
- Local fallback for every archetype.

Speed does not mean low value. It means the router must know what value to add before the model call.

## 13. Quality Mode Requirements

Quality mode can add:

- More complete structure.
- More context.
- Self-check against archetype grader.
- Multiple comparison dimensions.
- More nuanced caveats.

Quality mode should still avoid generic prompt bloat.

## 14. Evaluation Plan

Build an eval dataset organized by archetype.

| Archetype | Fixture Count | Required Grader Signals |
| --- | ---: | --- |
| Writing/editing | 20 | audience, tone, channel, no invention, output format |
| Practical guidance | 20 | situation, constraints, next steps, risks |
| Research/info | 20 | sources, dates, dimensions, caveats |
| Decision support | 20 | options, criteria, tradeoffs, recommendation |
| Coding implementation | 20 | scope, acceptance, files/surfaces, verification |
| Debugging | 20 | evidence, root cause, narrow fix, exact verification |
| Extraction | 20 | schema, null policy, no inference, output only |
| Summarization/translation | 20 | audience, length, fidelity, no outside info |
| Learning/tutoring | 20 | level, mental model, examples, practice |
| Marketing/sales/SEO | 20 | audience, offer, channel, CTA, claims policy |
| Job/career | 20 | target role, user evidence, no fabrication |
| Creative/brainstorming | 20 | count, diversity, constraints, selection criteria |
| Visual/image prompt | 20 | subject, composition, medium, constraints |
| Tool/reference workflow | 20 | tool action, extraction target, deliverable linkage |
| UI redesign/reference | 20 | reference search, visual decisions, implementation, visual verification |

Primary metric:

> Would this rewrite have prevented the most likely expensive follow-up?

Secondary metrics:

- Pattern accuracy.
- Unsupported fact rate.
- Output length.
- Latency.
- Human acceptance/no-regenerate rate.
- Tool-intent preservation.

## 15. Implementation Plan

### Phase 1: Taxonomy

- Add router types for the 15 archetypes.
- Add failure modes for ignored tool, missing evidence, missing audience, missing schema, missing acceptance, missing visual verification.
- Add value primitive metadata.

### Phase 2: Local Router

- Add deterministic regex/heuristic routing for common triggers.
- Add target-aware overrides for Codex, Gmail, Slack, ChatGPT, browser, IDE, and terminal.
- Add priority ranking when multiple archetypes match.

### Phase 3: Fallback Templates

- Create compact local fallback for every archetype.
- Keep fallbacks artifact-focused.
- Avoid generic "be clear and concise" filler.

### Phase 4: Model Packet Upgrade

- Send `archetype`, `value_primitive`, `failure_mode`, `rough_prompt`, `target`, and compact context.
- Update Speed compiler instructions to say: apply the chosen value primitive, not every best practice.

### Phase 5: Evals

- Expand `scripts/eval-router.ts` to 300+ fixtures.
- Add archetype grader strings.
- Add regression fixtures for real bad rewrites.

### Phase 6: UI/Receipt

- In context receipt, show:
  - route archetype
  - value primitive
  - fallback/model
  - latency
- Keep this advanced/debug-facing, not primary UX.

## 16. Acceptance Criteria

### Router Quality

- 95%+ archetype accuracy on eval fixtures.
- 90%+ value primitive accuracy on eval fixtures.
- 0 known regressions on recorded bad rewrites.
- No generic fallback when a higher-value primitive matches.

### User Value

- 80%+ no-regenerate/no-undo rate.
- 70%+ of sampled rewrites judged to prevent at least one likely follow-up.
- Explicit tool intent preserved in 98%+ of tool/reference prompts.

### Latency

- Speed p95 selected-text-only hotkey-to-paste under 1500 ms.
- Local routing under 10 ms.
- Local fallback available synchronously.

### Safety

- No disabled context source used.
- No fabricated facts, credentials, sources, or claims.
- High-stakes prompts include uncertainty and expert/source caveats.

## 17. Example: Bad vs Overhauled

Input:

```text
use the mobbin mcp to redesign the electron app UI to be like whisper flow style of clean typography and colors
```

Bad generic output:

```text
Goal: use the mobbin mcp to redesign the electron app UI...
Inspect relevant files. Keep scoped. Verify.
```

Overhauled output:

```text
Redesign the Electron app UI using the Mobbin MCP as the reference source.

Use Mobbin first: search for relevant clean productivity/settings/dashboard screens, inspect the returned visuals, and extract typography, spacing, palette, density, and control patterns. Do not copy proprietary UI exactly.

Then inspect the current Electron renderer/components/styles and implement a scoped redesign inspired by those patterns while preserving existing functionality.

Deliverables: updated UI code/styles, short design-decision summary with references used, and verification with relevant tests plus a local screenshot or visual check.
```

This is the difference between wording polish and time saved.

## 18. Final Product Principle

Shakespeare should optimize prompts the way a great operator clarifies work:

- identify the real job,
- bind the right tools and evidence,
- define the missing deliverable,
- state what good looks like,
- avoid over-explaining what the agent already knows.

The router should not ask, "How can I make this prompt sound better?"

It should ask:

> What missing contract would prevent the next wasted turn?

