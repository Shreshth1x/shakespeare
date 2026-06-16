import assert from "node:assert/strict";
import test from "node:test";
import { createBrowserContextBridge } from "../src/main/browserContextBridge";

test("browser context bridge accepts and stores fresh snapshots", async () => {
  const bridge = createBrowserContextBridge(0);
  await bridge.start();

  try {
    const response = await fetch(`http://127.0.0.1:${bridge.port}/v1/browser-context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://chatgpt.com/c/example",
        title: "ChatGPT conversation",
        hostname: "chatgpt.com",
        selectedText: "selected prompt",
        focusedText: "rough prompt",
        visibleText: "nearby page context",
        updatedAt: new Date().toISOString(),
        source: "browser_extension"
      })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(bridge.getLatest()?.hostname, "chatgpt.com");
    assert.deepEqual(bridge.getLatest()?.selectedText, "selected prompt");
  } finally {
    await bridge.stop();
  }
});
