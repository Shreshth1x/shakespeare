#!/usr/bin/env tsx

import { routePrompt } from "../src/shared/promptRouter";
import type { CompilePromptRequest, PromptContext, RouterPattern } from "../src/shared/types";

interface RouterFixture {
  category: string;
  roughPrompt: string;
  context: PromptContext;
  expectedPattern: RouterPattern;
}

const fixtures = buildFixtures();
const failures: Array<RouterFixture & { actualPattern: RouterPattern }> = [];

for (const fixture of fixtures) {
  const request: CompilePromptRequest = {
    rough_prompt: fixture.roughPrompt,
    mode: "general",
    optimization_mode: "speed",
    context: fixture.context
  };
  const decision = routePrompt(request);
  if (decision.pattern !== fixture.expectedPattern) {
    failures.push({
      ...fixture,
      actualPattern: decision.pattern
    });
  }
}

const accuracy = (fixtures.length - failures.length) / fixtures.length;
const byCategory = fixtures.reduce<Record<string, number>>((counts, fixture) => {
  counts[fixture.category] = (counts[fixture.category] ?? 0) + 1;
  return counts;
}, {});

console.log(`Router eval fixtures: ${fixtures.length}`);
console.log(`Pattern accuracy: ${(accuracy * 100).toFixed(1)}%`);
console.log(`Categories: ${Object.entries(byCategory).map(([key, count]) => `${key}=${count}`).join(", ")}`);

if (failures.length) {
  console.error("Failures:");
  for (const failure of failures.slice(0, 20)) {
    console.error(`- ${failure.category}: expected ${failure.expectedPattern}, got ${failure.actualPattern}: ${failure.roughPrompt}`);
  }
  process.exitCode = 1;
}

function buildFixtures(): RouterFixture[] {
  return [
    ...makeCodingFixtures(),
    ...makeDebuggingFixtures(),
    ...makeResearchFixtures(),
    ...makeExtractionFixtures(),
    ...makeReplyFixtures(),
    ...makeAmbiguousFixtures()
  ];
}

function makeCodingFixtures(): RouterFixture[] {
  const prompts = [
    "fix this auth bug",
    "implement the export button",
    "refactor this component safely",
    "build the settings route",
    "ship the API pagination change",
    "fix the failing checkout flow",
    "implement database migration for teams",
    "add tests for this route",
    "fix this TypeScript error in the repo",
    "build the onboarding component",
    "refactor the backend client",
    "implement the browser extension bridge",
    "fix this flaky integration test",
    "add a retry to the API call",
    "ship this small UI change",
    "build the webhook handler",
    "fix the auth callback",
    "implement the billing table",
    "add tests for settings persistence",
    "refactor the prompt compiler"
  ];
  return prompts.map((roughPrompt, index) => ({
    category: "coding-agent",
    roughPrompt,
    context: index % 2 === 0 ? { active_app: "Codex", window_title: "repo" } : { ide_editor: "Cursor", ide_workspace: "app" },
    expectedPattern: "agent_fix"
  }));
}

function makeDebuggingFixtures(): RouterFixture[] {
  const prompts = [
    "why is this failing",
    "investigate this stack trace",
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
    "why does this timeout happen"
  ];
  return prompts.map((roughPrompt) => ({
    category: "debugging",
    roughPrompt,
    context: {
      active_app: "Terminal",
      visible_text: "Error: Cannot read properties of undefined"
    },
    expectedPattern: "debug_root_cause"
  }));
}

function makeResearchFixtures(): RouterFixture[] {
  const prompts = [
    "research the best prompt optimization tools",
    "compare Claude Code and Codex",
    "find latest pricing for these competitors",
    "deep dive on context-aware writing apps",
    "investigate the market for AI hotkeys",
    "find sources on desktop OCR latency",
    "research best model for low latency rewriting",
    "compare Electron and Tauri for this app",
    "find current Windows signing requirements",
    "research competitor positioning",
    "compare API providers for prompt rewriting",
    "find best browser extension distribution path",
    "investigate privacy expectations for screen OCR",
    "research latest native messaging docs",
    "compare pricing strategies for prosumer AI tools",
    "find source-backed examples of prompt routers",
    "deep dive on PSReadLine integrations",
    "compare current speech-to-text apps",
    "research best onboarding pattern",
    "find market benchmarks for latency"
  ];
  return prompts.map((roughPrompt) => ({
    category: "research",
    roughPrompt,
    context: {
      browser_hostname: "chatgpt.com",
      browser_title: "Research prompt"
    },
    expectedPattern: "research_compare"
  }));
}

function makeExtractionFixtures(): RouterFixture[] {
  const prompts = [
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
  ];
  return prompts.map((roughPrompt) => ({
    category: "extraction",
    roughPrompt,
    context: {
      browser_visible_text: "Name: Avery, Email: avery@example.com, Status: waiting"
    },
    expectedPattern: "extract_schema"
  }));
}

function makeReplyFixtures(): RouterFixture[] {
  const prompts = [
    "reply to this",
    "draft an email response",
    "respond to this Slack message",
    "make this sound more professional",
    "write a concise reply",
    "draft a warm follow-up",
    "reply and ask for next steps",
    "respond politely",
    "rewrite this message",
    "draft the customer email",
    "reply with availability",
    "write a short message back",
    "respond to the investor",
    "draft a teammate update",
    "reply without overcommitting",
    "make this sound clearer",
    "write a Slack reply",
    "draft a Gmail response",
    "respond and thank them",
    "reply with a direct answer"
  ];
  return prompts.map((roughPrompt, index) => ({
    category: "writing-reply",
    roughPrompt,
    context:
      index % 2 === 0
        ? { active_app: "Slack", window_title: "team channel" }
        : { browser_url: "https://mail.google.com/mail/u/0/#inbox", browser_title: "Gmail" },
    expectedPattern: "reply_draft"
  }));
}

function makeAmbiguousFixtures(): RouterFixture[] {
  const prompts = [
    "make this better",
    "help me with this",
    "clean this up",
    "turn this into a better prompt",
    "improve wording",
    "make it clearer",
    "help with the ask",
    "optimize this",
    "rewrite this prompt",
    "make this more useful"
  ];
  return prompts.map((roughPrompt) => ({
    category: "ambiguous",
    roughPrompt,
    context: {},
    expectedPattern: "general_task"
  }));
}
