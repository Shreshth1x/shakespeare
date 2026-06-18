import assert from "node:assert/strict";
import test from "node:test";
import { findCustomMode, normalizeCustomModes } from "../src/shared/customModes";
import type { AppSettings } from "../src/shared/types";

const baseSettings: AppSettings = {
  hotkey: "CommandOrControl+Shift+P",
  previewHotkey: "CommandOrControl+Shift+Enter",
  backendUrl: "http://127.0.0.1:8787",
  clientToken: "",
  promptMode: "coding_agent",
  activeCustomModeId: null,
  customModes: [],
  optimizationMode: "speed",
  restoreClipboard: true,
  previewEnabled: false,
  focusedFieldRewriteEnabled: true,
  clipboardContextEnabled: true,
  screenContextEnabled: true,
  browserContextEnabled: true,
  ideContextEnabled: true,
  localHistoryEnabled: true,
  appDenylist: ["Personal Vault"],
  stats: {
    promptsEnhanced: 0,
    acceptedRewrites: 0,
    failedRewrites: 0,
    totalLatencyMs: 0,
    estimatedTimeSavedMs: 0,
    regeneratedPreviews: 0,
    canceledPreviews: 0
  }
};

test("normalizeCustomModes keeps valid modes and drops incomplete ones", () => {
  const modes = normalizeCustomModes([
    { id: "review", name: "Review", instructions: "Rewrite as a bug-focused review prompt." },
    { id: "missing-instructions", name: "Broken" },
    { name: "No id", instructions: "Has no usable id but gets a fallback." }
  ]);

  assert.equal(modes.length, 2);
  assert.equal(modes[0].id, "review");
  assert.equal(modes[1].id, "custom-3");
});

test("normalizeCustomModes dedupes by id and caps the list", () => {
  const modes = normalizeCustomModes([
    { id: "dup", name: "First", instructions: "A" },
    { id: "dup", name: "Second", instructions: "B" }
  ]);

  assert.equal(modes.length, 1);
  assert.equal(modes[0].name, "First");
});

test("findCustomMode resolves local custom modes by id", () => {
  const settings: AppSettings = {
    ...baseSettings,
    customModes: normalizeCustomModes([{ id: "debugger", name: "Debug plan", instructions: "Rewrite as a debugging plan." }])
  };

  assert.equal(findCustomMode(settings, "debugger")?.name, "Debug plan");
  assert.equal(findCustomMode(settings, "missing"), null);
});
