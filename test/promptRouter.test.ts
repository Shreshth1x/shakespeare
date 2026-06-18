import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCompactObservedContext,
  buildRoutedPrompt,
  buildRouterFallback,
  buildRouterPacket,
  isUsableRouterModelOutput,
  routePrompt
} from "../src/shared/promptRouter";
import type { CompilePromptRequest, RouterArchetype, RouterDecision, RouterValuePrimitive } from "../src/shared/types";

type ExpectedArchetype = RouterArchetype;
type ExpectedValuePrimitive = RouterValuePrimitive;

interface OverhaulDecisionMetadata {
  archetype?: ExpectedArchetype;
  valuePrimitive?: ExpectedValuePrimitive;
}

interface ArchetypeFallbackFixture {
  name: string;
  request: CompilePromptRequest;
  expectedArchetype: ExpectedArchetype;
  expectedValuePrimitive: ExpectedValuePrimitive;
  fallbackSignals: RegExp[];
}

function expectOverhaulMetadata(
  decision: RouterDecision,
  expectedArchetype: ExpectedArchetype,
  expectedValuePrimitive: ExpectedValuePrimitive
): void {
  const metadata = decision as RouterDecision & OverhaulDecisionMetadata;
  assert.equal(metadata.archetype, expectedArchetype);
  assert.equal(metadata.valuePrimitive, expectedValuePrimitive);
}

function expectFallbackSignals(fallback: string, signals: RegExp[]): void {
  const missing = signals
    .filter((signal) => !signal.test(fallback))
    .map((signal) => signal.toString());
  assert.deepEqual(missing, []);
}

function assertNotGenericFallback(fallback: string): void {
  assert.doesNotMatch(fallback, /^Task:/);
  assert.doesNotMatch(fallback, /Make the request clear and actionable/i);
  assert.doesNotMatch(fallback, /add only useful constraints or output shape/i);
}

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

test("router uses model-supported reasoning effort values", () => {
  const baseRequest: Omit<CompilePromptRequest, "optimization_mode"> = {
    rough_prompt: "fix this auth bug",
    mode: "coding_agent",
    context: {
      active_app: "Codex"
    }
  };

  assert.equal(routePrompt({ ...baseRequest, optimization_mode: "speed" }).reasoningEffort, "none");
  assert.equal(routePrompt({ ...baseRequest, optimization_mode: "quality" }).reasoningEffort, "low");
  assert.equal(routePrompt({ ...baseRequest, optimization_mode: "max_quality" }).reasoningEffort, "medium");
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
  assert(routed.packet.contract.length >= 4);
  expectOverhaulMetadata(routed.decision, "ui_redesign_reference", "reference_extraction");
  assert.match(routed.fallback, /Use mobbin mcp first/i);
  assert.match(routed.fallback, /concrete UI decisions/i);
  assert.match(routed.fallback, /typography/i);
  assert.match(routed.fallback, /renderer|components|styles/i);
  assert.match(routed.fallback, /screenshot|visual check/i);
  assert.doesNotMatch(routed.fallback, /^Goal:/);
  assert.doesNotMatch(routed.fallback, /\bDiscovery contract\b|\bAcceptance contract\b|\bImplementation contract\b/);
});

test("router treats typo-heavy broad Mobbin style prompts as UI redesign, not generic tool workflow", () => {
  const routed = buildRoutedPrompt({
    rough_prompt: "i want to redeseign everything to look whisper flow style using mobbin mcp",
    mode: "coding_agent",
    optimization_mode: "speed",
    context: {
      active_app: "Codex",
      window_title: "Codex",
      detected_target: "Codex",
      selected_text: "i want to redeseign everything to look whisper flow style using mobbin mcp"
    }
  });

  assert.equal(routed.decision.target, "codex");
  assert.equal(routed.decision.mode, "coding_agent");
  assert.equal(routed.decision.pattern, "ui_redesign");
  assert.equal(routed.decision.archetype, "ui_redesign_reference");
  assert.equal(routed.decision.valuePrimitive, "reference_extraction");
  assert.equal(routed.decision.failureMode, "missing_reference_workflow");
  assert(routed.packet.contract.length >= 4);
  assert(routed.packet.contract.some((slot) => /Whisper\/Wispr Flow-style/i.test(slot)));
  assert.doesNotMatch(routed.fallback, /^Use mobbin mcp as the required source/i);
  assert.match(routed.fallback, /Redesign the current app UI/i);
  assert.match(routed.fallback, /all primary visible app surfaces and states/i);
  assert(routed.packet.contract.some((slot) => /Whisper\/Wispr Flow-style/i.test(slot)));
  assert.match(routed.fallback, /typography/i);
  assert.match(routed.fallback, /screenshot|visual check/i);
});

test("router uses screen context and visual phrasing for design feedback instead of implementation", () => {
  const routed = buildRoutedPrompt({
    rough_prompt: "does this look cool?",
    mode: "coding_agent",
    optimization_mode: "speed",
    context: {
      active_app: "Codex",
      window_title: "Codex",
      detected_target: "Codex",
      visible_text: "Design chat: cool logo. The screen shows a bold blue wordmark, a rounded icon, and typography options."
    }
  });

  assert.equal(routed.decision.target, "codex");
  assert.equal(routed.decision.mode, "visual_feedback");
  assert.equal(routed.decision.pattern, "visual_feedback");
  assert.equal(routed.decision.archetype, "visual_design_feedback");
  assert.equal(routed.decision.valuePrimitive, "visual_feedback_contract");
  assert.equal(routed.decision.failureMode, "missing_visual_verification");
  assert(routed.contextUsed.includes("visible_text"));
  assert(routed.packet.context?.startsWith("Visible screen context: Design chat"));
  assert.match(routed.fallback, /Give quick design feedback/i);
  assert.match(routed.fallback, /Focus: does this look cool\?/i);
  assert.match(routed.fallback, /Visible context:\nDesign chat: cool logo/i);
  assert.match(routed.fallback, /blue wordmark/i);
  assert.match(routed.fallback, /rounded icon/i);
  assert.match(routed.fallback, /typography options/i);
  assert.match(routed.fallback, /cool and polished/i);
  assert.match(routed.fallback, /top 2-3 improvements/i);
  assert(routed.fallback.length < 620);
  assert.match(routed.fallback, /\n\nPlease cover:\n- Whether/i);
  assert.doesNotMatch(routed.fallback, /Answer the user's/i);
  assert.doesNotMatch(routed.fallback, /Use this visible screen context as evidence/i);
  assert.doesNotMatch(routed.fallback, /Implement in the current repo/i);
  assert.doesNotMatch(routed.fallback, /App: Codex|Window: Codex|Target: Codex/i);
  assert.doesNotMatch(routed.fallback, /Selection: does this look cool/i);
  assert.doesNotMatch(routed.fallback, /\bDiscovery contract\b|\bAcceptance contract\b|\bImplementation contract\b/);
});

test("router asks for visual context when visual feedback has no usable screen text", () => {
  const routed = buildRoutedPrompt({
    rough_prompt: "does this look cool?",
    mode: "coding_agent",
    optimization_mode: "speed"
  });

  assert.equal(routed.decision.mode, "visual_feedback");
  assert.equal(routed.decision.pattern, "visual_feedback");
  assert.equal(routed.decision.failureMode, "missing_visual_context");
  assert.match(routed.fallback, /ask for a screenshot or clearer visual context/i);
  assert.doesNotMatch(routed.fallback, /Use the visible context:/i);
  assert.doesNotMatch(routed.fallback, /Implement in the current repo/i);
});

test("router rejects long single-paragraph model output so pasted prompts stay scannable", () => {
  const slop =
    "Please review the visible design and explain whether it looks cool while using the screen context as evidence and covering the strongest part, weakest part, color, typography, hierarchy, polish, brand fit, and the top two or three improvements without inventing details or treating it as an implementation task.";

  assert.equal(isUsableRouterModelOutput(slop), true);
  assert.equal(isUsableRouterModelOutput(`${slop} ${slop}`), false);
  assert.equal(isUsableRouterModelOutput(`${slop}\n\n- Strongest part\n- Weakest part`), true);
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
  expectOverhaulMetadata(routed.decision, "research_info", "evidence_contract");
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

test("overhaul priority order chooses the highest-value primitive when signals overlap", () => {
  const fixtures: Array<{
    name: string;
    roughPrompt: string;
    expectedArchetype: ExpectedArchetype;
    expectedValuePrimitive: ExpectedValuePrimitive;
    fallbackSignals: RegExp[];
  }> = [
    {
      name: "safety beats explicit tool/reference",
      roughPrompt: "use web search to tell me whether I should stop taking my medication today",
      expectedArchetype: "practical_guidance",
      expectedValuePrimitive: "safety_uncertainty_contract",
      fallbackSignals: [/medical|medication/i, /uncertainty|caveat/i, /doctor|clinician|professional|emergency/i]
    },
    {
      name: "tool/reference beats current facts, schema, decision, and audience",
      roughPrompt:
        "use web search to find the latest pricing, decide the best option, and format it as warm professional JSON",
      expectedArchetype: "tool_reference_workflow",
      expectedValuePrimitive: "tool_binding",
      fallbackSignals: [/use web search/i, /first/i, /inspect|source|reference/i, /json/i]
    },
    {
      name: "current facts beat schema, decision, and audience",
      roughPrompt: "find the latest API pricing, choose the best plan, and format the answer as friendly JSON",
      expectedArchetype: "research_info",
      expectedValuePrimitive: "evidence_contract",
      fallbackSignals: [/current|latest/i, /source/i, /date/i, /caveat/i]
    },
    {
      name: "schema beats decision and audience",
      roughPrompt: "choose between A and B for my team and return a warm professional JSON object",
      expectedArchetype: "extraction_transformation",
      expectedValuePrimitive: "schema_contract",
      fallbackSignals: [/schema|json/i, /null|missing/i, /do not infer|unsupported/i]
    },
    {
      name: "decision beats audience",
      roughPrompt: "should I choose A or B? Write it in a warm professional tone for my manager",
      expectedArchetype: "decision_support",
      expectedValuePrimitive: "decision_contract",
      fallbackSignals: [/options|A or B/i, /criteria/i, /recommend/i, /change the answer/i]
    },
    {
      name: "audience wins before generic clarity",
      roughPrompt: "make this sound warmer and more professional for my VP",
      expectedArchetype: "writing_editing",
      expectedValuePrimitive: "audience_tone_contract",
      fallbackSignals: [/audience|VP/i, /tone/i, /do not invent/i]
    }
  ];

  for (const fixture of fixtures) {
    const routed = buildRoutedPrompt({
      rough_prompt: fixture.roughPrompt,
      mode: "general",
      optimization_mode: "speed",
      context: {
        browser_hostname: "chatgpt.com",
        browser_title: fixture.name
      }
    });

    expectOverhaulMetadata(routed.decision, fixture.expectedArchetype, fixture.expectedValuePrimitive);
    expectFallbackSignals(routed.fallback, fixture.fallbackSignals);
    assertNotGenericFallback(routed.fallback);
  }
});

test("router exposes all 15 archetype fallback contracts", () => {
  const fixtures: ArchetypeFallbackFixture[] = [
    {
      name: "writing and editing",
      request: {
        rough_prompt: "rewrite this update for my VP so it sounds warm, concise, and professional",
        mode: "general",
        optimization_mode: "speed",
        context: {}
      },
      expectedArchetype: "writing_editing",
      expectedValuePrimitive: "audience_tone_contract",
      fallbackSignals: [/audience|VP/i, /tone/i, /channel|format/i, /do not invent/i]
    },
    {
      name: "practical guidance",
      request: {
        rough_prompt: "make me a plan for moving apartments next month with a tight budget",
        mode: "general",
        optimization_mode: "speed",
        context: {}
      },
      expectedArchetype: "practical_guidance",
      expectedValuePrimitive: "practical_plan_contract",
      fallbackSignals: [/goal|plan/i, /constraints|budget/i, /next 3-5 actions|first concrete step/i, /risk|assumption/i]
    },
    {
      name: "seeking information and research",
      request: {
        rough_prompt: "research the latest Mac OCR apps and compare the best options",
        mode: "research",
        optimization_mode: "speed",
        context: {}
      },
      expectedArchetype: "research_info",
      expectedValuePrimitive: "evidence_contract",
      fallbackSignals: [/current primary sources|sources/i, /date/i, /compare/i, /caveat/i]
    },
    {
      name: "decision support",
      request: {
        rough_prompt: "should I build the Electron version first or the browser extension first",
        mode: "general",
        optimization_mode: "speed",
        context: {}
      },
      expectedArchetype: "decision_support",
      expectedValuePrimitive: "decision_contract",
      fallbackSignals: [/options/i, /criteria/i, /trade-?offs?/i, /recommend/i]
    },
    {
      name: "coding implementation",
      request: {
        rough_prompt: "implement the settings export button in the current repo",
        mode: "coding_agent",
        optimization_mode: "speed",
        context: {
          active_app: "Codex",
          window_title: "repo"
        }
      },
      expectedArchetype: "coding_implementation",
      expectedValuePrimitive: "acceptance_contract",
      fallbackSignals: [/current repo|files|surfaces/i, /scope|scoped/i, /acceptance|done/i, /verify|tests/i]
    },
    {
      name: "debugging",
      request: {
        rough_prompt: "debug this failing auth callback test",
        mode: "debugging",
        optimization_mode: "speed",
        context: {
          visible_text: "AssertionError: expected redirect URL"
        }
      },
      expectedArchetype: "debugging",
      expectedValuePrimitive: "reproduction_contract",
      fallbackSignals: [/reproduce|failing path/i, /evidence|context/i, /root cause/i, /exact failure|closest check/i]
    },
    {
      name: "extraction and transformation",
      request: {
        rough_prompt: "extract these notes into JSON with name, company, and next_action fields",
        mode: "general",
        optimization_mode: "speed",
        context: {}
      },
      expectedArchetype: "extraction_transformation",
      expectedValuePrimitive: "schema_contract",
      fallbackSignals: [/schema|fields/i, /null|missing/i, /do not infer|unsupported/i, /structured output only/i]
    },
    {
      name: "summarization and translation",
      request: {
        rough_prompt: "summarize this article for my team in five bullets",
        mode: "general",
        optimization_mode: "speed",
        context: {
          selected_text: "Long article text"
        }
      },
      expectedArchetype: "summarization_translation",
      expectedValuePrimitive: "fidelity_contract",
      fallbackSignals: [/audience|team/i, /five bullets|length/i, /preserve/i, /do not add outside information/i]
    },
    {
      name: "learning and tutoring",
      request: {
        rough_prompt: "teach me database indexes like I am smart but new and then quiz me",
        mode: "general",
        optimization_mode: "speed",
        context: {}
      },
      expectedArchetype: "learning_tutoring",
      expectedValuePrimitive: "learning_contract",
      fallbackSignals: [/level|new/i, /mental model/i, /example/i, /practice|quiz|misconception/i]
    },
    {
      name: "marketing sales SEO",
      request: {
        rough_prompt: "write landing page copy for Shakespeare aimed at busy founders with a clear CTA",
        mode: "general",
        optimization_mode: "speed",
        context: {}
      },
      expectedArchetype: "marketing_sales_seo",
      expectedValuePrimitive: "marketing_contract",
      fallbackSignals: [/audience|founders/i, /offer|channel|funnel/i, /CTA/i, /do not invent claims|claims/i]
    },
    {
      name: "job and career",
      request: {
        rough_prompt: "draft a cover letter for this product manager role using only my resume",
        mode: "general",
        optimization_mode: "speed",
        context: {}
      },
      expectedArchetype: "job_career",
      expectedValuePrimitive: "career_evidence_contract",
      fallbackSignals: [/target role|product manager/i, /provided experience|resume/i, /do not fabricate|fabricating/i, /format/i]
    },
    {
      name: "creative brainstorming",
      request: {
        rough_prompt: "brainstorm 20 names for my AI prompt compiler and mark the strongest options",
        mode: "general",
        optimization_mode: "speed",
        context: {}
      },
      expectedArchetype: "creative_brainstorming",
      expectedValuePrimitive: "creative_diversity_contract",
      fallbackSignals: [/20|number/i, /vary|diversity/i, /style|constraints/i, /strongest|rank/i]
    },
    {
      name: "image and visual prompt generation",
      request: {
        rough_prompt: "make an image generation prompt for a clean editorial illustration of a prompt router",
        mode: "general",
        optimization_mode: "speed",
        context: {}
      },
      expectedArchetype: "image_visual_prompt",
      expectedValuePrimitive: "image_visual_contract",
      fallbackSignals: [/subject/i, /composition/i, /medium|style/i, /constraints|negative/i]
    },
    {
      name: "tool and reference workflow",
      request: {
        rough_prompt: "use Figma to inspect the design and implement the matching React component",
        mode: "coding_agent",
        optimization_mode: "speed",
        context: {
          active_app: "Codex"
        }
      },
      expectedArchetype: "tool_reference_workflow",
      expectedValuePrimitive: "tool_binding",
      fallbackSignals: [/use Figma/i, /first/i, /inspect/i, /deliverable|component/i]
    },
    {
      name: "UI redesign with reference tool",
      request: {
        rough_prompt:
          "use the mobbin mcp to redesign the electron app UI to be like whisper flow style of clean typography and colors",
        mode: "coding_agent",
        optimization_mode: "speed",
        context: {
          active_app: "Codex"
        }
      },
      expectedArchetype: "ui_redesign_reference",
      expectedValuePrimitive: "reference_extraction",
      fallbackSignals: [/Use mobbin mcp first/i, /typography/i, /spacing/i, /screenshot|visual check/i]
    }
  ];

  const failures: string[] = [];

  for (const fixture of fixtures) {
    const routed = buildRoutedPrompt(fixture.request);
    const metadata = routed.decision as RouterDecision & OverhaulDecisionMetadata;
    const missingSignals = fixture.fallbackSignals
      .filter((signal) => !signal.test(routed.fallback))
      .map((signal) => signal.toString());

    if (metadata.archetype !== fixture.expectedArchetype) {
      failures.push(`${fixture.name}: expected archetype ${fixture.expectedArchetype}, got ${String(metadata.archetype)}`);
    }
    if (metadata.valuePrimitive !== fixture.expectedValuePrimitive) {
      failures.push(
        `${fixture.name}: expected valuePrimitive ${fixture.expectedValuePrimitive}, got ${String(metadata.valuePrimitive)}`
      );
    }
    if (missingSignals.length) {
      failures.push(`${fixture.name}: fallback missing ${missingSignals.join(", ")}`);
    }
    if (routed.packet.contract.length < 4) {
      failures.push(`${fixture.name}: expected at least 4 packet contract slots, got ${routed.packet.contract.length}`);
    }
    if (/\b(?:Discovery|Acceptance|Implementation|Verification|Evidence|Output) contract\b/i.test(routed.fallback)) {
      failures.push(`${fixture.name}: fallback exposed internal contract labels`);
    }
  }

  assert.deepEqual(failures, []);
});

test("high-stakes prompts route to safety caveats instead of ordinary current-fact research", () => {
  const routed = buildRoutedPrompt({
    rough_prompt: "is this chest pain serious and should I wait until tomorrow to see a doctor",
    mode: "general",
    optimization_mode: "speed",
    context: {
      browser_hostname: "chatgpt.com"
    }
  });

  expectOverhaulMetadata(routed.decision, "practical_guidance", "safety_uncertainty_contract");
  assert.match(routed.fallback, /medical|health/i);
  assert.match(routed.fallback, /uncertainty|caveat/i);
  assert.match(routed.fallback, /doctor|clinician|professional|emergency/i);
  assert.doesNotMatch(routed.fallback, /current primary sources/i);
  assertNotGenericFallback(routed.fallback);
});

test("higher-value primitives never fall back to generic clarity", () => {
  const requests: CompilePromptRequest[] = [
    {
      rough_prompt: "use Mobbin to restyle the onboarding screen and verify it visually",
      mode: "coding_agent",
      optimization_mode: "speed",
      context: {
        active_app: "Codex"
      }
    },
    {
      rough_prompt: "find current SOC 2 requirements for this vendor comparison",
      mode: "research",
      optimization_mode: "speed",
      context: {}
    },
    {
      rough_prompt: "convert this customer list into CSV with null for missing fields",
      mode: "general",
      optimization_mode: "speed",
      context: {}
    },
    {
      rough_prompt: "should we launch pricing A or B for founders",
      mode: "general",
      optimization_mode: "speed",
      context: {}
    },
    {
      rough_prompt: "make this email sound concise and warm for an investor",
      mode: "general",
      optimization_mode: "speed",
      context: {}
    }
  ];

  for (const request of requests) {
    const routed = buildRoutedPrompt(request);
    const metadata = routed.decision as RouterDecision & OverhaulDecisionMetadata;

    assert.notEqual(metadata.valuePrimitive, undefined);
    assert.notEqual(metadata.valuePrimitive, "generic_clarity_contract");
    assertNotGenericFallback(routed.fallback);
  }
});

test("model packet includes overhaul metadata for archetype and value primitive", () => {
  const request: CompilePromptRequest = {
    rough_prompt: "use the mobbin mcp to redesign the electron app UI to be like whisper flow style of clean typography and colors",
    mode: "coding_agent",
    optimization_mode: "speed",
    context: {
      active_app: "Codex",
      selected_text:
        "use the mobbin mcp to redesign the electron app UI to be like whisper flow style of clean typography and colors"
    }
  };

  const routed = buildRoutedPrompt(request);
  const packet = JSON.parse(routed.packetText) as Record<string, unknown>;

  expectOverhaulMetadata(routed.decision, "ui_redesign_reference", "reference_extraction");
  assert.equal(packet.archetype, "ui_redesign_reference");
  assert.equal(packet.value_primitive, "reference_extraction");
  assert.equal(packet.failure_mode, "missing_reference_workflow");
  assert.equal(packet.rough_prompt, request.rough_prompt);
  assert.equal(packet.target, "codex");
  assert(Array.isArray(packet.contract));
  assert((packet.contract as unknown[]).length >= 4);
  assert((packet.contract as string[]).some((slot) => /typography|spacing|palette/i.test(slot)));
  assert.equal(typeof packet.context === "string" || packet.context === undefined, true);
});
