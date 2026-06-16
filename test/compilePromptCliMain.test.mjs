import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { isMainModule } from "../scripts/compile-prompt.mjs";

test("compile-prompt CLI main guard matches the invoked script URL", () => {
  const scriptPath = resolve("scripts/compile-prompt.mjs");

  assert.equal(isMainModule(pathToFileURL(scriptPath).href, scriptPath), true);
});

test("compile-prompt CLI main guard is case-insensitive on Windows", () => {
  assert.equal(isMainModule("file:///D:/A/Shakespeare/scripts/compile-prompt.mjs", "D:\\a\\shakespeare\\scripts\\compile-prompt.mjs", "win32"), true);
});
