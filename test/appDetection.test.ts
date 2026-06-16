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
