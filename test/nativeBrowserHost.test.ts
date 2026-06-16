import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("native browser host forwards Chrome native messages to the local bridge", async () => {
  let receivedBody: unknown = null;
  const server = await listen((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      receivedBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  try {
    const response = await runNativeHost(
      {
        type: "browser_context",
        payload: {
          url: "https://chatgpt.com/c/example",
          title: "ChatGPT",
          hostname: "chatgpt.com",
          selectedText: "selected prompt",
          focusedText: "rough prompt",
          visibleText: "nearby page context",
          updatedAt: new Date().toISOString(),
          source: "browser_extension"
        }
      },
      `http://127.0.0.1:${server.port}/v1/browser-context`
    );

    assert.equal(response.ok, true);
    assert.equal((receivedBody as { hostname?: string }).hostname, "chatgpt.com");
  } finally {
    await server.close();
  }
});

test("native host installer writes a manifest with the requested extension id", async () => {
  const manifestDir = await mkdtemp(join(tmpdir(), "shakespeare-native-host-"));

  try {
    const result = spawn(process.execPath, [
      "scripts/install-native-browser-host.mjs",
      "--browser",
      "chrome",
      "--extension-id",
      "abcdefghijklmnopabcdefghijklmnop",
      "--manifest-dir",
      manifestDir
    ]);

    const exitCode = await waitForExit(result);
    assert.equal(exitCode, 0);

    const manifest = JSON.parse(
      await readFile(join(manifestDir, "com.shakespeare.promptcompiler.json"), "utf8")
    ) as {
      name: string;
      type: string;
      allowed_origins: string[];
    };
    assert.equal(manifest.name, "com.shakespeare.promptcompiler");
    assert.equal(manifest.type, "stdio");
    assert.deepEqual(manifest.allowed_origins, ["chrome-extension://abcdefghijklmnopabcdefghijklmnop/"]);
  } finally {
    await rm(manifestDir, { recursive: true, force: true });
  }
});

function runNativeHost(message: unknown, bridgeUrl: string): Promise<{ ok?: boolean; error?: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/native-browser-host.mjs"], {
      env: {
        ...process.env,
        SHAKESPEARE_BROWSER_CONTEXT_URL: bridgeUrl
      }
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderr).toString("utf8") || `native host exited ${code}`));
        return;
      }

      const output = Buffer.concat(stdout);
      const length = output.readUInt32LE(0);
      resolve(JSON.parse(output.subarray(4, 4 + length).toString("utf8")));
    });

    const payload = Buffer.from(JSON.stringify(message), "utf8");
    const header = Buffer.alloc(4);
    header.writeUInt32LE(payload.length, 0);
    child.stdin.end(Buffer.concat([header, payload]));
  });
}

function listen(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server: Server = createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.equal(typeof address, "object");
      assert(address);
      const info = address as AddressInfo;
      resolve({
        port: info.port,
        close: () =>
          new Promise((closeResolve) => {
            server.close(() => closeResolve());
          })
      });
    });
  });
}

function waitForExit(child: ReturnType<typeof spawn>): Promise<number | null> {
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
}
