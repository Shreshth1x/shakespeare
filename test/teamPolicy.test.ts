import assert from "node:assert/strict";
import test from "node:test";
import { applyTeamPolicy, effectiveAppDenylist, findCustomMode, normalizeTeamPolicy } from "../src/shared/teamPolicy";
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
  teamPolicy: null,
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

test("normalizeTeamPolicy accepts shared modes and privacy controls", () => {
  const policy = normalizeTeamPolicy({
    teamName: "Platform Team",
    sharedModes: [
      {
        id: "review",
        name: "Review",
        instructions: "Rewrite as a bug-focused review prompt."
      }
    ],
    privacyControls: {
      screenContextEnabled: {
        value: false,
        locked: true
      },
      localHistoryEnabled: false
    },
    appDenylist: ["1Password"],
    lockAppDenylist: true
  });

  assert(policy);
  assert.equal(policy.teamName, "Platform Team");
  assert.equal(policy.sharedModes[0].id, "team-review");
  assert.equal(policy.privacyControls.screenContextEnabled?.locked, true);
  assert.equal(policy.privacyControls.localHistoryEnabled?.value, false);
  assert.equal(policy.lockAppDenylist, true);
});

test("applyTeamPolicy enforces locked privacy controls", () => {
  const policy = normalizeTeamPolicy({
    teamName: "Platform Team",
    privacyControls: {
      screenContextEnabled: {
        value: false,
        locked: true
      },
      browserContextEnabled: {
        value: false,
        locked: false
      }
    }
  });

  const settings = applyTeamPolicy({
    ...baseSettings,
    teamPolicy: policy
  });

  assert.equal(settings.screenContextEnabled, false);
  assert.equal(settings.browserContextEnabled, true);
});

test("team shared modes are available to prompt resolution", () => {
  const policy = normalizeTeamPolicy({
    teamName: "Platform Team",
    sharedModes: [
      {
        id: "debugger",
        name: "Debug plan",
        instructions: "Rewrite as a debugging plan."
      }
    ]
  });

  assert(policy);
  const mode = findCustomMode(
    {
      ...baseSettings,
      teamPolicy: policy
    },
    "team-debugger"
  );

  assert.equal(mode?.name, "Debug plan");
});

test("effectiveAppDenylist combines team and local denylist entries", () => {
  const policy = normalizeTeamPolicy({
    teamName: "Platform Team",
    appDenylist: ["1Password", "Personal Vault"]
  });

  const denylist = effectiveAppDenylist({
    ...baseSettings,
    teamPolicy: policy
  });

  assert.deepEqual(denylist, ["1Password", "Personal Vault"]);
});
