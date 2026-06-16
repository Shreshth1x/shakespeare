import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { compileWithModel } from "./openaiClient.js";
import { validateCompileRequest } from "../shared/promptCompiler.js";

const port = Number(process.env.PORT ?? 8787);
const clientToken = process.env.SHAKESPEARE_CLIENT_TOKEN;

const server = createServer(async (req, res) => {
  try {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/healthz") {
      sendJson(res, 200, {
        ok: true,
        openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
        speedModel: process.env.OPENAI_MODEL_SPEED || process.env.OPENAI_MODEL || "gpt-5.4-nano",
        qualityModel: process.env.OPENAI_MODEL_QUALITY || process.env.OPENAI_MODEL || "gpt-5.4-mini"
      });
      return;
    }

    if (req.method === "POST" && req.url === "/v1/compile-prompt") {
      if (!isAuthorized(req)) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }

      const rawBody = await readBody(req);
      const parsed = safeJsonParse(rawBody);
      if (!parsed.ok) {
        sendJson(res, 400, { error: "Request body must be valid JSON." });
        return;
      }

      const validation = validateCompileRequest(parsed.value);
      if (!validation.ok) {
        sendJson(res, 400, { error: validation.error });
        return;
      }

      const result = await compileWithModel(validation.value);
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown server error" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Shakespeare backend listening on http://127.0.0.1:${port}`);
});

function isAuthorized(req: IncomingMessage): boolean {
  if (!clientToken) return true;
  return req.headers.authorization === `Bearer ${clientToken}`;
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 80_000) {
        reject(new Error("Request body is too large."));
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function safeJsonParse(rawBody: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(rawBody) };
  } catch {
    return { ok: false };
  }
}
