# Provenance: Prompt Optimization Research Brief

Date: 2026-06-16

## Primary Sources Used

- OpenAI, Prompt engineering guide: https://developers.openai.com/api/docs/guides/prompt-engineering
  - Used for current OpenAI recommendations around coding prompts, agentic tasks, tool examples, testing, and structured markdown guidance.
- OpenAI, Prompt guidance: https://developers.openai.com/api/docs/guides/prompt-guidance
  - Used for current GPT-5-series guidance on agentic eagerness, reasoning effort, conflict removal, migration/evals, and meta-prompting.
- OpenAI, GPT-4.1 prompting guide: https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide
  - Used for agentic workflow reminders: persistence, tool use, and planning.
- OpenAI, Prompt optimizer: https://developers.openai.com/api/docs/guides/prompt-optimizer
  - Used for dataset-backed optimizer framing, annotations/graders, repeat optimization, and production review cautions.
- OpenAI, Prompt caching: https://developers.openai.com/api/docs/guides/prompt-caching
  - Used for stable-prefix and latency/cost recommendations.
- Anthropic, Prompting best practices: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
  - Used for clear/direct instructions, examples, structured tags, thinking guidance, self-checking, and agentic systems guidance.
- Anthropic, Prompting tools: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-tools
  - Used for generator/improver workflow, prompt templates, variables, examples, and prompt improver steps.
- Anthropic, Prompt caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
  - Used for static-content-first cache structure and cache breakpoint guidance.
- Anthropic, System prompts release notes: https://platform.claude.com/docs/en/release-notes/system-prompts
  - Used as evidence that production assistants use evolving system prompts and that system prompts are distinct from API prompts.
- Google, Gemini prompt design strategies: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/prompts/prompt-design-strategies
  - Used for best practices and prompt health checklist: clear instructions, few-shot examples, context, system instructions, structure, reasoning, decomposition, iteration, and ambiguity/conflict checks.
- Google Cloud Blog, Vertex AI Prompt Optimizer: https://cloud.google.com/blog/products/ai-machine-learning/announcing-vertex-ai-prompt-optimizer
  - Used for data-driven optimization framing: optimize instructions and demonstrations against chosen evaluation metrics.
- OpenAI Codex default base instructions: https://github.com/openai/codex/blob/main/codex-rs/protocol/src/prompts/base_instructions/default.md
  - Used as a public example of a production coding-agent system prompt with scoped behavior, preambles, planning, validation, and final-response constraints.

## Research Papers Used

- Schulhoff et al., The Prompt Report: https://arxiv.org/abs/2406.06608
  - Used for the claim that prompt engineering is a broad taxonomy, not one universal technique.
- Zhou et al., Large Language Models Are Human-Level Prompt Engineers / APE: https://arxiv.org/abs/2211.01910
  - Used for automatic instruction generation and selection as score-function optimization.
- Yang et al., Large Language Models as Optimizers / OPRO: https://arxiv.org/abs/2309.03409
  - Used for iterative LLM-generated candidate optimization against measured values.
- Pryzant et al., Automatic Prompt Optimization with Gradient Descent and Beam Search / ProTeGi: https://aclanthology.org/2023.emnlp-main.494/
  - Used for textual-gradient optimization with minibatches, beam search, and bandit selection.
- Khattab et al., DSPy: https://arxiv.org/abs/2310.03714
  - Used for compiler/eval framing and the idea of optimizing LM pipelines rather than hand-writing brittle prompt strings.
- Madaan et al., Self-Refine: https://arxiv.org/abs/2303.17651
  - Used for the quality-mode/offline self-feedback refinement pattern.
- Wei et al., Chain-of-Thought Prompting: https://arxiv.org/abs/2201.11903
  - Used for complex-reasoning prompting evidence.
- Wang et al., Self-Consistency: https://arxiv.org/abs/2203.11171
  - Used for the claim that multi-sample reasoning can improve correctness but is too slow for default inline mode.
- Wang et al., Plan-and-Solve: https://arxiv.org/abs/2305.04091
  - Used for the plan/decompose guidance on multi-step reasoning tasks.
- Yao et al., ReAct: https://arxiv.org/abs/2210.03629
  - Used for reasoning plus action/tool-use guidance on environment-interacting tasks.
- Yuksekgonul et al., TextGrad: https://arxiv.org/abs/2406.07496
  - Used for textual feedback as optimization signal for compound AI systems.
- Fernando et al., Promptbreeder: https://arxiv.org/abs/2309.16797
  - Used for evolutionary prompt optimization as an offline/domain-specific optimizer.
- Mu et al., A Closer Look at System Prompt Robustness: https://arxiv.org/abs/2502.12197
  - Used for limitations of system prompts under conflicts/adversarial inputs.

## Local Project Sources Used

- `README.md`
  - Used for current Shakespeare product scope and local development model.
- `CONTEXT_AWARE_PROMPT_COMPILER_PRD.md`
  - Used for product thesis, prompt modes, latency targets, prompt compiler contract, and model policy.
- `src/shared/promptCompiler.ts`
  - Used for current compiler instruction structure, mode guidance, context compaction, and local fallback behavior.
- `src/backend/openaiClient.ts`
  - Used for current one-call Responses API implementation, speed/quality model selection, minimal reasoning effort, and token caps.
- `test/promptCompiler.test.ts`
  - Used for current expectations around scoped coding-agent guidance and context inclusion.

## Synthesis Notes

- I treated current vendor docs as time-sensitive and verified them live on 2026-06-16.
- I treated academic papers as primary sources for technique claims.
- I did not rely on blog/listicle prompt examples except Google Cloud's official Vertex AI Prompt Optimizer announcement.
- The main inference is product-specific: because Shakespeare has a 1 to 2 second inline hotkey target, eval-heavy optimizers belong in offline/template-improvement loops, while the hotkey path should use one-call task/failure routing.

