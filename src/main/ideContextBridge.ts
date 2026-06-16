import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { IdeContextSnapshot } from "../shared/types";

const MAX_BODY_BYTES = 120_000;
const FRESHNESS_MS = 5 * 60 * 1000;

export interface IdeContextBridge {
  port: number;
  running: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  getLatest: () => IdeContextSnapshot | null;
}

export function createIdeContextBridge(port = Number(process.env.SHAKESPEARE_IDE_CONTEXT_PORT ?? 8792)): IdeContextBridge {
  let latest: IdeContextSnapshot | null = null;
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

          if (req.method === "POST" && req.url === "/v1/ide-context") {
            try {
              const rawBody = await readBody(req);
              const parsed = JSON.parse(rawBody) as Partial<IdeContextSnapshot>;
              const next = normalizeSnapshot(parsed);
              if (!next) {
                sendJson(res, 400, { error: "Invalid IDE context payload." });
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

function normalizeSnapshot(input: Partial<IdeContextSnapshot>): IdeContextSnapshot | null {
  if (!input.editor || typeof input.editor !== "string") return null;

  return {
    editor: truncate(input.editor, 80),
    workspaceName: truncate(input.workspaceName ?? "", 160),
    workspaceFolders: normalizeFolders(input.workspaceFolders),
    filePath: truncate(input.filePath ?? "", 700),
    relativeFilePath: truncate(input.relativeFilePath ?? "", 300),
    languageId: truncate(input.languageId ?? "", 80),
    selectedText: truncate(input.selectedText ?? "", 2600),
    visibleText: truncate(input.visibleText ?? "", 3200),
    diagnostics: truncate(input.diagnostics ?? "", 1800),
    gitDiff: truncate(input.gitDiff ?? "", 3600),
    updatedAt: new Date().toISOString(),
    source: "ide_extension"
  };
}

function normalizeFolders(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is string => typeof item === "string")
    .map((item) => truncate(item, 500))
    .filter(Boolean)
    .slice(0, 8);
}

function summarize(snapshot: IdeContextSnapshot) {
  return {
    editor: snapshot.editor,
    workspaceName: snapshot.workspaceName,
    filePath: snapshot.relativeFilePath || snapshot.filePath,
    languageId: snapshot.languageId,
    hasSelection: snapshot.selectedText.length > 0,
    hasVisibleText: snapshot.visibleText.length > 0,
    hasDiagnostics: snapshot.diagnostics.length > 0,
    hasGitDiff: snapshot.gitDiff.length > 0,
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
        reject(new Error("IDE context payload is too large."));
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
