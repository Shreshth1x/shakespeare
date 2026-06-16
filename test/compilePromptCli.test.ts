import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { spawn } from "node:child_process";
import test from "node:test";

test("compile-prompt CLI sends terminal context and prints optimized prompt", async () => {
  let receivedBody: any = null;
  const server = createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/compile-prompt") {
      res.writeHead(404);
      res.end();
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      receivedBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          optimized_prompt: "Optimized terminal prompt",
          context_used: ["selected_text", "active_app"],
          warnings: [],
          model: "mock",
          latency_ms: 12
        })
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.notEqual(address, null);
  assert.notEqual(typeof address, "string");
  const port = (address as AddressInfo).port;

  try {
    const result = await runCli(["--backend", `http://127.0.0.1:${port}`, "--no-fallback"], "fix this bug");
    assert.equal(result.code, 0);
    assert.equal(result.stdout, "Optimized terminal prompt");
    assert.equal(receivedBody.rough_prompt, "fix this bug");
    assert.equal(receivedBody.mode, "coding_agent");
    assert.equal(receivedBody.optimization_mode, "speed");
    assert.equal(receivedBody.context.active_app, "terminal");
    assert.equal(receivedBody.context.detected_target, "Terminal");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

function runCli(args: string[], input: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/compile-prompt.mjs", ...args], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}
