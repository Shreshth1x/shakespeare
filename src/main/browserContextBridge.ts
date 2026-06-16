import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { BrowserContextSnapshot } from "../shared/types";

const MAX_BODY_BYTES = 80_000;
const FRESHNESS_MS = 5 * 60 * 1000;

export interface BrowserContextBridge {
  port: number;
  running: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  getLatest: () => BrowserContextSnapshot | null;
}

export function createBrowserContextBridge(port = Number(process.env.SHAKESPEARE_BROWSER_CONTEXT_PORT ?? 8791)): BrowserContextBridge {
  let latest: BrowserContextSnapshot | null = null;
  let server: Server | null = null;
  let running = false;
  let actualPort = port;

  return {
    get port() {
      return actualPort;
    },
    get running() {
      return running;
    },
    start: () =>
      new Promise((resolve) => {
        if (server) {
          resolve();
          return;
        }

        server = createServer(async (req, res) => {
          setHeaders(res);

          if (req.method === "OPTIONS") {
            res.writeHead(204);
            res.end();
            return;
          }

          if (req.method === "GET" && req.url === "/healthz") {
            sendJson(res, 200, {
              ok: true,
              latest: latest ? summarize(latest) : null
            });
            return;
          }

          if (req.method === "POST" && req.url === "/v1/browser-context") {
            try {
              const rawBody = await readBody(req);
              const parsed = JSON.parse(rawBody) as Partial<BrowserContextSnapshot>;
              const next = normalizeSnapshot(parsed);
              if (!next) {
                sendJson(res, 400, { error: "Invalid browser context payload." });
                return;
              }

              latest = next;
              sendJson(res, 200, { ok: true, latest: summarize(next) });
            } catch (error) {
              sendJson(res, 400, { error: error instanceof Error ? error.message : "Invalid request." });
            }
            return;
          }

          sendJson(res, 404, { error: "Not found" });
        });

        server.listen(port, "127.0.0.1", () => {
          const address = server?.address();
          actualPort = typeof address === "object" && address ? address.port : port;
          running = true;
          resolve();
        });

        server.on("error", () => {
          running = false;
          resolve();
        });
      }),
    stop: () =>
      new Promise((resolve) => {
        if (!server) {
          running = false;
          resolve();
          return;
        }

        server.close(() => {
          server = null;
          running = false;
          resolve();
        });
      }),
    getLatest: () => {
      if (!latest) return null;
      const age = Date.now() - new Date(latest.updatedAt).getTime();
      return age <= FRESHNESS_MS ? structuredClone(latest) : null;
    }
  };
}

function normalizeSnapshot(input: Partial<BrowserContextSnapshot>): BrowserContextSnapshot | null {
  if (!input.url || typeof input.url !== "string") return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input.url);
  } catch {
    return null;
  }

  return {
    url: truncate(input.url, 500),
    title: truncate(input.title ?? "", 250),
    hostname: truncate(input.hostname || parsedUrl.hostname, 120),
    selectedText: truncate(input.selectedText ?? "", 1600),
    focusedText: truncate(input.focusedText ?? "", 1600),
    visibleText: truncate(input.visibleText ?? "", 2600),
    updatedAt: new Date().toISOString(),
    source: "browser_extension"
  };
}

function summarize(snapshot: BrowserContextSnapshot) {
  return {
    url: snapshot.url,
    title: snapshot.title,
    hostname: snapshot.hostname,
    hasSelection: snapshot.selectedText.length > 0,
    hasFocusedText: snapshot.focusedText.length > 0,
    hasVisibleText: snapshot.visibleText.length > 0,
    updatedAt: snapshot.updatedAt
  };
}

function setHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    req.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        reject(new Error("Browser context payload is too large."));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function truncate(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}
