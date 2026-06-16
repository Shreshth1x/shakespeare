import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("PowerShell integration binds PSReadLine buffer rewrite to compile helper", () => {
  const source = readFileSync("integrations/powershell/ShakespearePrompt.ps1", "utf8");

  assert.match(source, /Set-PSReadLineKeyHandler/);
  assert.match(source, /GetBufferState/);
  assert.match(source, /compile-prompt\.mjs/);
  assert.match(source, /--active-app/);
  assert.match(source, /PowerShell/);
  assert.match(source, /Replace\(0, \$Original\.Length, \$Replacement\)/);
});
