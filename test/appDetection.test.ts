import assert from "node:assert/strict";
import test from "node:test";
import { detectTargetTool, isAppDenied } from "../src/shared/appDetection";

test("detectTargetTool infers common AI and coding surfaces", () => {
  assert.equal(
    detectTargetTool({
      active_app: "Google Chrome",
      window_title: "ChatGPT - draft prompt"
    }),
    "ChatGPT"
  );

  assert.equal(
    detectTargetTool({
      active_app: "Cursor",
      window_title: "auth.ts"
    }),
    "Cursor"
  );

  assert.equal(
    detectTargetTool({
      active_app: "Google Chrome",
      browser_hostname: "claude.ai",
      browser_title: "Claude"
    }),
    "Claude"
  );

  assert.equal(
    detectTargetTool({
      ide_editor: "Visual Studio Code",
      ide_file_path: "/repo/src/auth.ts"
    }),
    "VS Code"
  );
});

test("isAppDenied matches configured app or window fragments", () => {
  assert.equal(
    isAppDenied(
      {
        active_app: "1Password",
        window_title: "Login item"
      },
      ["1password"]
    ),
    true
  );

  assert.equal(
    isAppDenied(
      {
        active_app: "Chrome",
        window_title: "ChatGPT"
      },
      ["Slack"]
    ),
    false
  );
});
