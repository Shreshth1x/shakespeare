import assert from "node:assert/strict";
import test from "node:test";
import { createIdeContextBridge } from "../src/main/ideContextBridge";

test("IDE context bridge accepts and stores fresh snapshots", async () => {
  const bridge = createIdeContextBridge(0);
  await bridge.start();

  try {
    const response = await fetch(`http://127.0.0.1:${bridge.port}/v1/ide-context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        editor: "Cursor",
        workspaceName: "shakespeare",
        workspaceFolders: ["/Users/shreshth/Documents/Shakespeare"],
        filePath: "/Users/shreshth/Documents/Shakespeare/src/main/index.ts",
        relativeFilePath: "src/main/index.ts",
        languageId: "typescript",
        selectedText: "const context = buildContext();",
        visibleText: "function buildContext() {}",
        diagnostics: "Error ts(2304) at 12:7: Cannot find name context.",
        gitDiff: "diff --git a/src/main/index.ts b/src/main/index.ts",
        updatedAt: new Date().toISOString(),
        source: "ide_extension"
      })
    });

    assert.equal(response.status, 200);
    assert.equal(bridge.getLatest()?.editor, "Cursor");
    assert.equal(bridge.getLatest()?.relativeFilePath, "src/main/index.ts");
    assert.match(bridge.getLatest()?.diagnostics ?? "", /Cannot find name/);
  } finally {
    await bridge.stop();
  }
});

test("IDE context bridge rejects payloads without an editor", async () => {
  const bridge = createIdeContextBridge(0);
  await bridge.start();

  try {
    const response = await fetch(`http://127.0.0.1:${bridge.port}/v1/ide-context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filePath: "/tmp/example.ts"
      })
    });

    assert.equal(response.status, 400);
    assert.equal(bridge.getLatest(), null);
  } finally {
    await bridge.stop();
  }
});
