#!/usr/bin/env node

const DEFAULT_BRIDGE_URL = "http://127.0.0.1:8791/v1/browser-context";

main().catch((error) => {
  writeNativeMessage({
    ok: false,
    error: error instanceof Error ? error.message : "Native host failed."
  });
});

async function main() {
  const message = await readNativeMessage();
  if (message.type !== "browser_context" || !message.payload || typeof message.payload !== "object") {
    writeNativeMessage({
      ok: false,
      error: "Unsupported native message."
    });
    return;
  }

  const response = await fetch(process.env.SHAKESPEARE_BROWSER_CONTEXT_URL || DEFAULT_BRIDGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message.payload)
  });

  if (!response.ok) {
    writeNativeMessage({
      ok: false,
      error: `Local browser bridge returned ${response.status}.`
    });
    return;
  }

  writeNativeMessage({
    ok: true,
    transport: "native-host"
  });
}

function readNativeMessage() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalLength = 0;

    process.stdin.on("data", (chunk) => {
      chunks.push(chunk);
      totalLength += chunk.length;
    });

    process.stdin.on("end", () => {
      const buffer = Buffer.concat(chunks, totalLength);
      if (buffer.length < 4) {
        reject(new Error("Native message is missing its length header."));
        return;
      }

      const messageLength = buffer.readUInt32LE(0);
      const messageBody = buffer.subarray(4, 4 + messageLength).toString("utf8");
      try {
        resolve(JSON.parse(messageBody));
      } catch {
        reject(new Error("Native message is not valid JSON."));
      }
    });

    process.stdin.on("error", reject);
  });
}

function writeNativeMessage(payload) {
  const message = Buffer.from(JSON.stringify(payload), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(message.length, 0);
  process.stdout.write(Buffer.concat([header, message]));
}
