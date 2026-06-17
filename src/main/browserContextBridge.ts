import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { BrowserContextSnapshot } from "../shared/types";

const MAX_BODY_BYTES = 80_000;
const FRESHNESS_MS = 5 * 60 * 1000;
const REPLACEMENT_TIMEOUT_MS = 1800;
const REPLACEMENT_TTL_MS = 5000;

export interface BrowserContextBridge {
  port: number;
  running: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  getLatest: () => BrowserContextSnapshot | null;
  replaceFocusedText: (text: string, targetUrl?: string) => Promise<boolean>;
}

interface PendingBrowserReplacement {
  id: string;
  text: string;
  url: string;
  hostname: string;
  createdAt: number;
  resolve: (ok: boolean) => void;
  timeout: NodeJS.Timeout;
}

export function createBrowserContextBridge(port = Number(process.env.SHAKESPEARE_BROWSER_CONTEXT_PORT ?? 8791)): BrowserContextBridge {
  let latest: BrowserContextSnapshot | null = null;
  let pendingReplacement: PendingBrowserReplacement | null = null;
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
              latest: latest ? summarize(latest) : null,
              pendingReplacement: pendingReplacement ? { id: pendingReplacement.id, hostname: pendingReplacement.hostname } : null
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

          if (req.method === "GET" && req.url?.startsWith("/v1/browser-replacement")) {
            const requestUrl = new URL(req.url, "http://127.0.0.1");
            const pageUrl = requestUrl.searchParams.get("url") ?? "";
            const command = takePendingReplacement(pendingReplacement, pageUrl);
            if (!command) {
              res.writeHead(204);
              res.end();
              return;
            }

            sendJson(res, 200, {
              id: command.id,
              text: command.text
            });
            return;
          }

          if (req.method === "POST" && req.url === "/v1/browser-replacement/complete") {
            try {
              const rawBody = await readBody(req);
              const parsed = JSON.parse(rawBody) as { id?: unknown; ok?: unknown };
              if (pendingReplacement && parsed.id === pendingReplacement.id) {
                completePendingReplacement(Boolean(parsed.ok));
              }
              sendJson(res, 200, { ok: true });
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
          completePendingReplacement(false);
          server = null;
          running = false;
          resolve();
        });
      }),
    getLatest: () => {
      if (!latest) return null;
      const age = Date.now() - new Date(latest.updatedAt).getTime();
      return age <= FRESHNESS_MS ? structuredClone(latest) : null;
    },
    replaceFocusedText: (text: string, targetUrl?: string) =>
      new Promise((resolve) => {
        if (!latest || !latest.focusedText || latest.focusedTextTruncated) {
          resolve(false);
          return;
        }

        const url = targetUrl || latest.url;
        completePendingReplacement(false);
        pendingReplacement = {
          id: randomUUID(),
          text,
          url,
          hostname: safeHostname(url) || latest.hostname,
          createdAt: Date.now(),
          resolve,
          timeout: setTimeout(() => completePendingReplacement(false), REPLACEMENT_TIMEOUT_MS)
        };
      })
  };

  function completePendingReplacement(ok: boolean): void {
    if (!pendingReplacement) return;
    const command = pendingReplacement;
    pendingReplacement = null;
    clearTimeout(command.timeout);
    command.resolve(ok);
  }
}

function takePendingReplacement(command: PendingBrowserReplacement | null, pageUrl: string): PendingBrowserReplacement | null {
  if (!command) return null;
  if (Date.now() - command.createdAt > REPLACEMENT_TTL_MS) return null;
  if (!pageUrl || pageUrl !== command.url) return null;
  return command;
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
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
    focusedText: truncate(input.focusedText ?? "", 24_000),
    focusedTextTruncated: Boolean(input.focusedTextTruncated),
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
    focusedTextTruncated: Boolean(snapshot.focusedTextTruncated),
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
