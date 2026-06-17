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

test("browser context bridge queues focused-field replacement commands", async () => {
  const bridge = createBrowserContextBridge(0);
  await bridge.start();

  try {
    const pageUrl = "https://chatgpt.com/c/example";
    await fetch(`http://127.0.0.1:${bridge.port}/v1/browser-context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: pageUrl,
        title: "ChatGPT conversation",
        hostname: "chatgpt.com",
        selectedText: "",
        focusedText: "rough prompt",
        visibleText: "nearby page context",
        updatedAt: new Date().toISOString(),
        source: "browser_extension"
      })
    });

    const replacement = bridge.replaceFocusedText("optimized prompt");
    const commandResponse = await fetch(
      `http://127.0.0.1:${bridge.port}/v1/browser-replacement?url=${encodeURIComponent(pageUrl)}`
    );
    assert.equal(commandResponse.status, 200);

    const command = (await commandResponse.json()) as { id: string; text: string };
    assert.equal(command.text, "optimized prompt");

    const completionResponse = await fetch(`http://127.0.0.1:${bridge.port}/v1/browser-replacement/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: command.id, ok: true })
    });
    assert.equal(completionResponse.status, 200);
    assert.equal(await replacement, true);
  } finally {
    await bridge.stop();
  }
});

test("browser context bridge refuses truncated focused text replacement", async () => {
  const bridge = createBrowserContextBridge(0);
  await bridge.start();

  try {
    await fetch(`http://127.0.0.1:${bridge.port}/v1/browser-context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://chatgpt.com/c/example",
        title: "ChatGPT conversation",
        hostname: "chatgpt.com",
        selectedText: "",
        focusedText: "x".repeat(30_000),
        focusedTextTruncated: true,
        visibleText: "nearby page context",
        updatedAt: new Date().toISOString(),
        source: "browser_extension"
      })
    });

    assert.equal(await bridge.replaceFocusedText("optimized prompt"), false);
  } finally {
    await bridge.stop();
  }
});
