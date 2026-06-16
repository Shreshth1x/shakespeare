// @ts-check

const vscode = require("vscode");
const http = require("node:http");
const https = require("node:https");
const { execFile } = require("node:child_process");
const path = require("node:path");

let autoSendDisposables = [];
let debounceTimer = undefined;

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("shakespeare.refreshContext", async () => {
      const result = await sendCurrentContext({ showStatus: true });
      if (result.ok) {
        vscode.window.setStatusBarMessage("Shakespeare IDE context refreshed", 2500);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("shakespeare.autoSend")) {
        configureAutoSend(context);
      }
    })
  );

  configureAutoSend(context);
  scheduleContextSend();
}

function deactivate() {
  clearAutoSendDisposables();
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
}

function configureAutoSend(context) {
  clearAutoSendDisposables();

  if (!getConfig().get("autoSend", true)) {
    return;
  }

  autoSendDisposables = [
    vscode.window.onDidChangeActiveTextEditor(() => scheduleContextSend()),
    vscode.window.onDidChangeTextEditorSelection(() => scheduleContextSend()),
    vscode.languages.onDidChangeDiagnostics(() => scheduleContextSend()),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (vscode.window.activeTextEditor?.document.uri.toString() === document.uri.toString()) {
        scheduleContextSend();
      }
    })
  ];

  for (const disposable of autoSendDisposables) {
    context.subscriptions.push(disposable);
  }
}

function clearAutoSendDisposables() {
  for (const disposable of autoSendDisposables) {
    disposable.dispose();
  }
  autoSendDisposables = [];
}

function scheduleContextSend() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    void sendCurrentContext({ showStatus: false });
  }, 650);
}

async function sendCurrentContext(options) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    if (options.showStatus) {
      vscode.window.showWarningMessage("Shakespeare could not find an active editor.");
    }
    return { ok: false };
  }

  try {
    const snapshot = await buildSnapshot(editor);
    await postJson(getConfig().get("bridgeUrl", "http://127.0.0.1:8792/v1/ide-context"), snapshot);
    return { ok: true };
  } catch (error) {
    if (options.showStatus) {
      const message = error instanceof Error ? error.message : "Unknown error";
      vscode.window.showWarningMessage(`Shakespeare IDE context was not sent: ${message}`);
    }
    return { ok: false };
  }
}

async function buildSnapshot(editor) {
  const config = getConfig();
  const document = editor.document;
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  const filePath = document.uri.scheme === "file" ? document.uri.fsPath : document.uri.toString();
  const relativeFilePath = workspaceFolder && document.uri.scheme === "file"
    ? path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath)
    : vscode.workspace.asRelativePath(document.uri, false);

  return {
    editor: vscode.env.appName || "VS Code",
    workspaceName: workspaceFolder?.name ?? vscode.workspace.name ?? "",
    workspaceFolders: vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [],
    filePath,
    relativeFilePath,
    languageId: document.languageId,
    selectedText: getSelectedText(editor),
    visibleText: getVisibleText(editor, config.get("maxVisibleCharacters", 4000)),
    diagnostics: formatDiagnostics(document.uri),
    gitDiff: config.get("includeGitDiff", true) ? await getGitDiff(workspaceFolder, filePath) : "",
    updatedAt: new Date().toISOString(),
    source: "ide_extension"
  };
}

function getSelectedText(editor) {
  const selection = editor.selection;
  if (selection.isEmpty) {
    return "";
  }
  return editor.document.getText(selection);
}

function getVisibleText(editor, maxCharacters) {
  const chunks = [];
  let remaining = Math.max(500, maxCharacters);

  for (const range of editor.visibleRanges) {
    if (remaining <= 0) break;
    const text = editor.document.getText(range);
    chunks.push(text.slice(0, remaining));
    remaining -= text.length;
  }

  return chunks.join("\n\n--- visible range ---\n\n").slice(0, Math.max(500, maxCharacters));
}

function formatDiagnostics(uri) {
  const severity = ["Error", "Warning", "Info", "Hint"];
  return vscode.languages
    .getDiagnostics(uri)
    .slice(0, 16)
    .map((diagnostic) => {
      const line = diagnostic.range.start.line + 1;
      const column = diagnostic.range.start.character + 1;
      const level = severity[diagnostic.severity] ?? "Diagnostic";
      const code = diagnostic.code != null ? ` [${String(diagnostic.code)}]` : "";
      const source = diagnostic.source ? ` ${diagnostic.source}` : "";
      return `${level}${source}${code} at ${line}:${column}: ${diagnostic.message}`;
    })
    .join("\n");
}

function getGitDiff(workspaceFolder, filePath) {
  if (!workspaceFolder || !filePath || filePath.startsWith("untitled:")) {
    return Promise.resolve("");
  }

  return new Promise((resolve) => {
    execFile(
      "git",
      ["diff", "--no-color", "--", filePath],
      {
        cwd: workspaceFolder.uri.fsPath,
        timeout: 900,
        maxBuffer: 220000
      },
      (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve("");
          return;
        }
        resolve(stdout.trim().slice(0, 12000));
      }
    );
  });
}

function postJson(urlString, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const payload = JSON.stringify(body);
    const client = url.protocol === "https:" ? https : http;

    const request = client.request(
      {
        method: "POST",
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        },
        timeout: 1200
      },
      (response) => {
        response.resume();
        response.on("end", () => {
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            resolve();
            return;
          }
          reject(new Error(`bridge returned ${response.statusCode ?? "unknown status"}`));
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("bridge request timed out"));
    });
    request.on("error", reject);
    request.write(payload);
    request.end();
  });
}

function getConfig() {
  return vscode.workspace.getConfiguration("shakespeare");
}

module.exports = {
  activate,
  deactivate
};
