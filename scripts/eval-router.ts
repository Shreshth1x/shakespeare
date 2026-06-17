#!/usr/bin/env tsx

import { buildRoutedPrompt } from "../src/shared/promptRouter";
import type {
  CompilePromptRequest,
  PromptContext,
  RouterArchetype,
  RouterPattern,
  RouterValuePrimitive
} from "../src/shared/types";

interface RouterFixture {
  category: string;
  roughPrompt: string;
  context: PromptContext;
  expectedArchetype: RouterArchetype;
  expectedPattern: RouterPattern;
  expectedPrimitive: RouterValuePrimitive;
  contractSignals: RegExp[];
}

interface Failure {
  fixture: RouterFixture;
  actualArchetype: RouterArchetype;
  actualPattern: RouterPattern;
  actualPrimitive: RouterValuePrimitive;
  missingSignals: string[];
  contractSlotCount: number;
  fallback: string;
}

const fixtures = buildFixtures();
assertCoverage(fixtures);
const failures: Failure[] = [];
const durations: number[] = [];
const roughLengths: number[] = [];
const packetLengths: number[] = [];
const fallbackLengths: number[] = [];
const contractSlotCounts: number[] = [];
const byCategory = new Map<string, { total: number; archetype: number; pattern: number; primitive: number; contract: number }>();

for (const fixture of fixtures) {
  const request: CompilePromptRequest = {
    rough_prompt: fixture.roughPrompt,
    mode: "general",
    optimization_mode: "speed",
    context: fixture.context
  };
  const start = performance.now();
  const routed = buildRoutedPrompt(request);
  durations.push(performance.now() - start);
  roughLengths.push(fixture.roughPrompt.length);
  packetLengths.push(routed.packetText.length);
  fallbackLengths.push(routed.fallback.length);
  contractSlotCounts.push(routed.packet.contract.length);

  const missingSignals = fixture.contractSignals
    .filter((signal) => !signal.test(routed.fallback))
    .map((signal) => signal.toString());

  const actual = {
    archetype: routed.decision.archetype,
    pattern: routed.decision.pattern,
    primitive: routed.decision.valuePrimitive,
    contract: missingSignals.length === 0
  };
  const bucket = byCategory.get(fixture.category) ?? { total: 0, archetype: 0, pattern: 0, primitive: 0, contract: 0 };
  bucket.total += 1;
  if (actual.archetype === fixture.expectedArchetype) bucket.archetype += 1;
  if (actual.pattern === fixture.expectedPattern) bucket.pattern += 1;
  if (actual.primitive === fixture.expectedPrimitive) bucket.primitive += 1;
  if (actual.contract) bucket.contract += 1;
  byCategory.set(fixture.category, bucket);

  if (
    actual.archetype !== fixture.expectedArchetype ||
    actual.pattern !== fixture.expectedPattern ||
    actual.primitive !== fixture.expectedPrimitive ||
    missingSignals.length ||
    routed.packet.contract.length < 4
  ) {
    failures.push({
      fixture,
      actualArchetype: actual.archetype,
      actualPattern: actual.pattern,
      actualPrimitive: actual.primitive,
      missingSignals,
      contractSlotCount: routed.packet.contract.length,
      fallback: routed.fallback
    });
  }
}

const total = fixtures.length;
const archetypePass = total - failures.filter((failure) => failure.actualArchetype !== failure.fixture.expectedArchetype).length;
const patternPass = total - failures.filter((failure) => failure.actualPattern !== failure.fixture.expectedPattern).length;
const primitivePass = total - failures.filter((failure) => failure.actualPrimitive !== failure.fixture.expectedPrimitive).length;
const contractPass = total - failures.filter((failure) => failure.missingSignals.length > 0).length;

console.log(`Router eval fixtures: ${total} across ${byCategory.size} archetypes`);
console.log(`Archetype accuracy: ${pct(archetypePass, total)}`);
console.log(`Pattern accuracy: ${pct(patternPass, total)}`);
console.log(`Value primitive accuracy: ${pct(primitivePass, total)}`);
console.log(`Contract signal pass: ${pct(contractPass, total)}`);
console.log(`Routing duration: p50=${percentile(durations, 50).toFixed(3)}ms p95=${percentile(durations, 95).toFixed(3)}ms max=${Math.max(...durations).toFixed(3)}ms`);
console.log(
  `Prompt length: p50=${Math.round(percentile(roughLengths, 50))} chars p95=${Math.round(percentile(roughLengths, 95))} chars max=${Math.max(...roughLengths)} chars`
);
console.log(
  `Packet length: p50=${Math.round(percentile(packetLengths, 50))} chars p95=${Math.round(percentile(packetLengths, 95))} chars max=${Math.max(...packetLengths)} chars`
);
console.log(
  `Fallback length: p50=${Math.round(percentile(fallbackLengths, 50))} chars p95=${Math.round(percentile(fallbackLengths, 95))} chars max=${Math.max(...fallbackLengths)} chars`
);
console.log(
  `Contract slots: p50=${Math.round(percentile(contractSlotCounts, 50))} p95=${Math.round(percentile(contractSlotCounts, 95))} min=${Math.min(...contractSlotCounts)}`
);
console.log("By category:");
for (const [category, bucket] of [...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(
    `- ${category}: archetype=${pct(bucket.archetype, bucket.total)} pattern=${pct(bucket.pattern, bucket.total)} primitive=${pct(bucket.primitive, bucket.total)} contract=${pct(bucket.contract, bucket.total)}`
  );
}

if (failures.length) {
  console.error(`Failures: ${failures.length}`);
  for (const failure of failures.slice(0, 40)) {
    console.error(
      `- ${failure.fixture.category}: expected ${failure.fixture.expectedArchetype}/${failure.fixture.expectedPattern}/${failure.fixture.expectedPrimitive}, got ${failure.actualArchetype}/${failure.actualPattern}/${failure.actualPrimitive}: ${failure.fixture.roughPrompt}`
    );
    if (failure.missingSignals.length) {
      console.error(`  missing contract signals: ${failure.missingSignals.join(", ")}`);
    }
    if (failure.contractSlotCount < 4) {
      console.error(`  contract slots too shallow: ${failure.contractSlotCount}`);
    }
  }
  process.exitCode = 1;
}

function fixture(
  category: string,
  expectedArchetype: RouterArchetype,
  expectedPattern: RouterPattern,
  expectedPrimitive: RouterValuePrimitive,
  contractSignals: RegExp[],
  prompts: string[],
  context: PromptContext | ((prompt: string, index: number) => PromptContext) = {}
): RouterFixture[] {
  return prompts.map((roughPrompt, index) => ({
    category,
    roughPrompt,
    context: typeof context === "function" ? context(roughPrompt, index) : context,
    expectedArchetype,
    expectedPattern,
    expectedPrimitive,
    contractSignals
  }));
}

function buildFixtures(): RouterFixture[] {
  return [
    ...fixture("writing_editing", "writing_editing", "write_edit", "audience_tone_contract", [/Preserve/i, /audience|tone|channel/i, /Do not invent/i], [
      "rewrite this",
      "make this sound better",
      "improve wording",
      "make this more professional",
      "polish this update for my manager",
      "write a blog intro about prompt routers",
      "draft a short memo for the team",
      "edit this paragraph so it is clearer",
      "make this announcement warm but concise",
      "rewrite this note for an executive audience",
      "turn this rough thought into a clean Slack update",
      "write a short apology message without overexplaining",
      "make this investor update direct and calm",
      "draft a product update email for beta users",
      "tighten this onboarding copy",
      "rewrite this prompt so it is easier for ChatGPT",
      "make this ask clearer and less rambling",
      "write a concise internal changelog entry",
      "edit this response so it sounds confident but not arrogant",
      "turn these bullets into a polished status update"
    ]),
    ...fixture("practical_guidance", "practical_guidance", "practical_plan", "practical_plan_contract", [/next 3-5 actions/i, /risks?|assumptions?/i, /first concrete step/i], [
      "how do I do this",
      "help me figure this out",
      "what should I do next",
      "make me a plan",
      "create a plan for moving apartments next month",
      "help me organize a launch checklist",
      "how should I set up a simple sales process",
      "make a weekend plan to clean up my finances",
      "help me decide next steps for this project",
      "create a practical plan for learning React",
      "walk me through setting up a lightweight hiring process",
      "help me plan a week of customer interviews",
      "make a step-by-step plan for migrating my notes",
      "what should I do before releasing this desktop app",
      "help me prepare for a hard conversation with my manager",
      "create a low-budget plan for furnishing an apartment",
      "help me build a repeatable morning routine",
      "make a plan for validating this startup idea",
      "how do I recover after missing a deadline",
      "give me an action plan for improving prompt quality"
    ]),
    ...fixture("research_info", "research_info", "research_compare", "evidence_contract", [/current primary sources|sources/i, /dates?/i, /caveats?/i, /compare|scope/i], [
      "research this",
      "find the latest pricing",
      "compare Claude Code and Codex",
      "find current Windows signing requirements",
      "research the best prompt optimization tools",
      "investigate the market for AI hotkeys",
      "find source-backed examples of prompt routers",
      "compare Electron and Tauri for desktop apps",
      "research competitor positioning for Wispr Flow",
      "find the latest browser extension distribution rules",
      "compare API providers for low latency rewriting",
      "find market benchmarks for prompt latency",
      "research privacy expectations for screen OCR",
      "deep dive on PSReadLine integrations",
      "compare current speech-to-text apps",
      "research the best onboarding pattern for a utility app",
      "find source-backed pricing for AI writing tools",
      "investigate whether prompt libraries are still popular",
      "compare native messaging docs across Chrome and Edge",
      "research current macOS accessibility permission behavior"
    ], { browser_hostname: "chatgpt.com" }),
    ...fixture("decision_support", "decision_support", "decision_matrix", "decision_contract", [/options?/i, /criteria/i, /tradeoffs?/i, /recommend/i, /change the answer/i], [
      "should I do A or B",
      "which option is best",
      "help me decide",
      "recommend the best path",
      "should we build Electron first or the browser extension first",
      "choose between Supabase and Firebase for this app",
      "decide whether to ship preview mode by default",
      "should I optimize quality or speed first",
      "help me choose a launch price",
      "recommend whether to use local OCR or cloud OCR",
      "should I target developers or general writers first",
      "choose between a Chrome extension and native app",
      "should I make this open source",
      "decide if I should hire a designer now",
      "which model should power speed mode",
      "should I keep team policy in MVP",
      "recommend the best packaging strategy",
      "choose a name between Shakespeare and PromptFlow",
      "should I add screenshots to the dashboard",
      "help me decide the next product wedge"
    ]),
    ...fixture("coding_implementation", "coding_implementation", "agent_fix", "acceptance_contract", [/current repo/i, /acceptance criteria/i, /verify/i, /changed files/i], [
      "fix this auth bug",
      "implement the export button",
      "refactor this component safely",
      "build the settings route",
      "ship the API pagination change",
      "add tests for this route",
      "fix this TypeScript error in the repo",
      "build the onboarding component",
      "refactor the backend client",
      "implement the browser extension bridge",
      "add a retry to the API call",
      "build the webhook handler",
      "implement the billing table",
      "add tests for settings persistence",
      "refactor the prompt compiler",
      "wire the preview toggle to settings",
      "implement the settings export button in the current repo",
      "add a status pill for backend health",
      "build the hotkey recorder component",
      "fix the renderer layout overflow"
    ], (_prompt, index) => (index % 2 === 0 ? { active_app: "Codex", window_title: "repo" } : { ide_editor: "Cursor", ide_workspace: "app" })),
    ...fixture("debugging", "debugging", "debug_root_cause", "reproduction_contract", [/observed failure|failure/i, /evidence/i, /root cause/i, /exact failure|closest check/i], [
      "why is this failing",
      "debug this exception",
      "why does this test fail",
      "root cause this crash",
      "this endpoint is broken",
      "traceback in auth handler",
      "explain this error",
      "why is the job flaky",
      "diagnose the failed deploy",
      "debug the race condition",
      "why does login not work",
      "investigate the failing migration",
      "what caused this failure",
      "debug the null pointer exception",
      "find the root cause of this broken flow",
      "why is the worker crashing",
      "investigate this console error",
      "debug this failed webhook",
      "why does this timeout happen",
      "format as JSON: why is auth failing?"
    ], { active_app: "Terminal", visible_text: "Error: Cannot read properties of undefined" }),
    ...fixture("extraction_transformation", "extraction_transformation", "extract_schema", "schema_contract", [/structured output only/i, /schema/i, /null/i, /do not infer/i], [
      "extract this into JSON",
      "convert this list to CSV",
      "parse this email into a table",
      "format this as JSON with fields",
      "summarize into bullet rows",
      "extract action items",
      "convert this config to YAML",
      "parse the stack trace into columns",
      "extract names and emails",
      "format this into a table",
      "convert the notes into schema",
      "extract dates from this thread",
      "parse this invoice text",
      "summarize into a checklist",
      "convert this markdown to CSV",
      "extract bug reports",
      "format as JSON array",
      "parse meeting notes",
      "extract product requirements",
      "convert this raw data"
    ], { browser_visible_text: "Name: Avery, Email: avery@example.com, Status: waiting" }),
    ...fixture("summarization_translation", "summarization_translation", "summarize_translate", "fidelity_contract", [/Preserve/i, /nuance|named entities/i, /Do not add outside information/i], [
      "summarize this",
      "translate this to Spanish",
      "give me the main point",
      "condense this article",
      "summarize this for executives",
      "translate this email into French",
      "make a five bullet summary",
      "recap this meeting transcript",
      "summarize the selected text for my team",
      "turn this into a TLDR",
      "summarize this without losing nuance",
      "translate this but preserve names and tone",
      "give me a concise summary of these notes",
      "summarize this research into takeaways",
      "condense this memo for a founder",
      "recap the argument in plain English",
      "summarize this support thread",
      "translate this product copy to Hindi",
      "make a short summary with caveats",
      "explain the main point of this article"
    ], { selected_text: "Long article text with named entities and caveats." }),
    ...fixture("learning_tutoring", "learning_tutoring", "teach_practice", "learning_contract", [/mental model/i, /example/i, /practice/i, /misconceptions?/i], [
      "teach me this",
      "explain like I am smart but new",
      "help me study",
      "quiz me",
      "teach me database indexes like I am smart but new",
      "explain OAuth with examples",
      "help me learn system design",
      "quiz me on SQL joins",
      "walk me through React state",
      "teach me how DNS works",
      "explain vector databases from first principles",
      "help me study for a product interview",
      "teach me prompt routing",
      "explain async JavaScript with a mental model",
      "quiz me on networking basics",
      "help me learn unit testing",
      "explain OAuth errors in simple terms",
      "teach me database migrations",
      "help me understand model latency",
      "walk me through accessibility APIs"
    ]),
    ...fixture("marketing_sales_seo", "marketing_sales_seo", "marketing_artifact", "marketing_contract", [/audience/i, /offer/i, /channel/i, /CTA/i, /Do not invent/i], [
      "write landing page copy",
      "create social posts",
      "generate SEO article",
      "draft sales email",
      "make ad variations",
      "write launch copy for Shakespeare",
      "create a cold email for founders",
      "write homepage copy for a prompt hotkey app",
      "generate LinkedIn posts for launch week",
      "write SEO outline for prompt optimization",
      "draft a sales email to devtool teams",
      "make Google ad variations",
      "create a product positioning blurb",
      "write pricing page copy",
      "generate App Store copy",
      "write a webinar invite",
      "create a nurture email sequence",
      "make a CTA for the dashboard",
      "draft a launch tweet thread",
      "write a short sales one-pager"
    ]),
    ...fixture("job_career", "job_career", "career_artifact", "career_evidence_contract", [/target role/i, /provided experience|supplied experience/i, /fabricat/i, /format/i], [
      "write my resume bullet",
      "draft cover letter",
      "prep me for interview",
      "optimize LinkedIn",
      "draft a cover letter for this PM role",
      "rewrite my resume for a founder role",
      "make behavioral interview answers",
      "turn this experience into STAR stories",
      "write a recruiter message",
      "tailor my resume to this job description",
      "prep me for a deployment strategist interview",
      "write LinkedIn about section",
      "make my internship bullets stronger",
      "draft an answer to tell me about yourself",
      "optimize my resume summary",
      "write a follow up after interview",
      "help me explain a career gap",
      "draft a networking message",
      "make a portfolio project description",
      "create interview questions for this role"
    ]),
    ...fixture("creative_brainstorming", "creative_brainstorming", "creative_brief", "creative_diversity_contract", [/options?/i, /vary|diversity/i, /style/i, /strongest/i], [
      "brainstorm names",
      "give me ideas",
      "create concepts",
      "write a story",
      "brainstorm taglines for Shakespeare",
      "give me 20 app name ideas",
      "create campaign concepts",
      "brainstorm features for a prompt compiler",
      "write three story premises",
      "generate brand concept directions",
      "give me launch video ideas",
      "brainstorm onboarding metaphors",
      "create naming options for speed mode",
      "give me ideas for a demo script",
      "brainstorm user delight moments",
      "make creative concepts for a subway ad",
      "generate product tagline options",
      "create three visual themes",
      "brainstorm community campaign ideas",
      "give me weird but usable feature names"
    ]),
    ...fixture("image_visual_prompt", "image_visual_prompt", "image_generation_prompt", "image_visual_contract", [/subject/i, /composition/i, /medium|style/i, /constraints/i], [
      "make an image prompt",
      "generate Midjourney prompt",
      "create illustration prompt",
      "write a prompt for a clean product illustration",
      "generate a DALL-E prompt for a prompt router",
      "make an image generation prompt for an app icon",
      "create a visual prompt for a dashboard hero",
      "write a stable diffusion prompt for a desktop utility",
      "make an illustration prompt with soft lighting",
      "generate a prompt for a UI concept image",
      "create an editorial illustration prompt",
      "write a visual prompt for a founder at a laptop",
      "make a prompt for a translucent app icon",
      "generate a product screenshot illustration prompt",
      "write an image prompt for workflow automation",
      "create a prompt for a clean vector-style illustration",
      "generate a photorealistic prompt for a workspace",
      "write a prompt for a minimal poster",
      "make a prompt for a prompt compiler mascot-free image",
      "create an image prompt with negative constraints"
    ]),
    ...fixture("visual_design_feedback", "visual_design_feedback", "visual_feedback", "visual_feedback_contract", [/visible|screen|context/i, /composition|hierarchy|typography|color/i, /strongest/i, /improvements?|screenshot/i], [
      "does this look good?",
      "does this look cool?",
      "does this logo look professional?",
      "is this design working?",
      "how does this screen feel?",
      "what do you think of this mockup?",
      "review this visible design",
      "critique this logo",
      "does this layout feel polished?",
      "is this hero section clear?",
      "does this icon look premium?",
      "how does this visual direction read?",
      "is this poster composition good?",
      "does this typography look right?",
      "are these colors working?",
      "does this app screen look usable?",
      "give feedback on this design",
      "review the screenshot on my screen",
      "does this brand mark look cool?",
      "is this UI visually balanced?"
    ], {
      active_app: "Codex",
      window_title: "Codex",
      visible_text: "Design chat: cool logo. The screen shows a blue wordmark, rounded icon, layout options, and typography samples."
    }),
    ...fixture("tool_reference_workflow", "tool_reference_workflow", "tool_workflow", "tool_binding", [/Use|First/i, /tool|source|Figma|Notion|dataset|docs|web search/i, /Extract|Inspect/i, /deliverable|final/i], [
      "use Figma to inspect the design and implement the matching React component",
      "use web search to compare these pricing tiers",
      "use this dataset to compare churn by segment",
      "use Notion MCP to summarize meeting notes",
      "use GitHub to inspect the open issues",
      "use the browser to test the checkout flow",
      "use Google Drive to find the PRD and summarize it",
      "use Supabase docs to fix this policy",
      "use the API docs to implement this call",
      "use the attached reference to write the spec",
      "use the CSV to create a table",
      "use the MCP tool to fetch account context",
      "use GitHub search to find related PRs",
      "use the dataset first before recommending a plan",
      "use Notion as the source of truth",
      "use web search and cite current sources",
      "use the design file as reference",
      "use docs to verify this integration",
      "use the browser context to draft a reply",
      "use the provided screenshots to build the UI"
    ]),
    ...fixture("ui_redesign_reference", "ui_redesign_reference", "ui_redesign", "reference_extraction", [/Use .*first/i, /typography/i, /spacing/i, /palette/i, /screenshot|visual check/i], [
      "use the mobbin mcp to redesign the electron app UI to be like whisper flow style of clean typography and colors",
      "i want to redeseign everything to look whisper flow style using mobbin mcp",
      "use Mobbin references to restyle the settings dashboard",
      "redesign this frontend using Mobbin screens for clean SaaS typography",
      "use Figma as inspiration and polish the renderer UI",
      "use the design MCP to benchmark settings screens and update the app",
      "redesign the dashboard with better spacing typography and colors",
      "restyle this Electron app based on product UI references",
      "use Mobbin to find command palette examples and improve this screen",
      "polish the UI layout with reference screenshots before editing",
      "redesign the onboarding screen with cleaner controls and visual hierarchy",
      "use Mobbin to redesign the desktop dashboard",
      "benchmark Whisper Flow style and improve the Electron renderer",
      "use UI references to redesign the settings panel",
      "restyle the prompt dashboard with clean typography and color",
      "use Figma references to improve the app layout",
      "redesign the Electron app controls with reference screenshots",
      "use Mobbin screens to polish the privacy settings UI",
      "make the renderer look like a clean voice utility using references",
      "use product UI examples to redesign this onboarding view",
      "redesign the app UI with references and verify screenshots"
    ], { active_app: "Codex", window_title: "repo" })
  ];
}

function pct(pass: number, total: number): string {
  return `${((pass / total) * 100).toFixed(1)}%`;
}

function assertCoverage(fixtures: RouterFixture[]): void {
  const counts = fixtures.reduce<Map<string, number>>((acc, fixture) => {
    acc.set(fixture.category, (acc.get(fixture.category) ?? 0) + 1);
    return acc;
  }, new Map());

  if (counts.size < 15) {
    throw new Error(`Expected at least 15 archetypes, got ${counts.size}`);
  }
  if (fixtures.length < 300) {
    throw new Error(`Expected at least 300 fixtures, got ${fixtures.length}`);
  }

  for (const [category, count] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (count < 20) {
      throw new Error(`Expected at least 20 fixtures for ${category}, got ${count}`);
    }
  }
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index] ?? 0;
}
