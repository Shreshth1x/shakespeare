import { app, BrowserWindow, Menu, Notification, Tray, globalShortcut, ipcMain, nativeImage, shell } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { compilePrompt, checkBackend } from "./backendClient";
import { createBrowserContextBridge } from "./browserContextBridge";
import { createIdeContextBridge } from "./ideContextBridge";
import { createScreenContextService } from "./screenContext";
import { SettingsStore, toDashboardState } from "./settings";
import { captureSelectedText, getActiveWindowContext, pasteReplacement } from "./textReplacement";
import { detectTargetTool, isAppDenied } from "../shared/appDetection";
import { effectiveAppDenylist, findCustomMode } from "../shared/teamPolicy";
import type {
  AppSettings,
  CompilePromptRequest,
  CompilePromptResponse,
  ContextReceipt,
  CustomPromptModeInput,
  HistoryRecord,
  PendingPreview,
  PromptContext
} from "../shared/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let store: SettingsStore;
let backendHealthy = false;
let registeredHotkey = false;
let registeredPreviewHotkey = false;
const browserBridge = createBrowserContextBridge();
const ideBridge = createIdeContextBridge();
const screenContext = createScreenContextService();
let pendingPreview:
  | (PendingPreview & {
      previousClipboardText: string;
      restoreClipboard: boolean;
      request: CompilePromptRequest;
    })
  | null = null;

app.whenReady().then(async () => {
  store = new SettingsStore();
  await browserBridge.start();
  await ideBridge.start();
  backendHealthy = await checkBackend(store.get());
  createWindow();
  createTray();
  registerConfiguredHotkey();
  registerIpc();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  void browserBridge.stop();
  void ideBridge.stop();
});

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 860,
    minHeight: 640,
    show: false,
    title: "Shakespeare",
    backgroundColor: "#f6f8f4",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function createTray(): void {
  tray = new Tray(createTrayIcon());
  tray.setToolTip("Shakespeare");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Shakespeare", click: () => mainWindow?.show() },
      { label: "Rewrite selection", click: () => void rewriteSelection() },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() }
    ])
  );
}

function createTrayIcon(): Electron.NativeImage {
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="7" fill="#1F2522"/><path d="M9 21.5c2.6 1.4 6.7 1.6 9.1.3 2.5-1.3 2.6-3.6.3-4.8l-4.6-2.4c-1.4-.7-1.2-1.8.2-2.4 1.5-.6 4-.5 6 .5" fill="none" stroke="#E9C46A" stroke-width="2.4" stroke-linecap="round"/></svg>`
  );
  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${svg}`);
}

function registerConfiguredHotkey(): void {
  globalShortcut.unregisterAll();
  registeredHotkey = globalShortcut.register(store.get().hotkey, () => {
    void rewriteSelection();
  });
  registeredPreviewHotkey = globalShortcut.register(store.get().previewHotkey, () => {
    void acceptPreview();
  });
  pushState();
}

function registerIpc(): void {
  ipcMain.handle("state:get", async () => {
    backendHealthy = await checkBackend(store.get());
    return dashboardState();
  });

  ipcMain.handle("settings:update", async (_event, patch: Partial<AppSettings>) => {
    store.update(patch);
    backendHealthy = await checkBackend(store.get());
    registerConfiguredHotkey();
    return dashboardState();
  });

  ipcMain.handle("backend:check", async () => {
    backendHealthy = await checkBackend(store.get());
    pushState();
    return backendHealthy;
  });

  ipcMain.handle("compile:sample", async (_event, roughPrompt: string) => {
    const settings = store.get();
    const startedAt = Date.now();
    const response = await compilePrompt(
      settings,
      buildCompileRequest(roughPrompt, { active_app: "Shakespeare dashboard", selected_text: roughPrompt }, settings)
    );
    store.setLastReceipt(toReceipt(response));
    addHistory(roughPrompt, response.optimized_prompt, response, settings);
    store.recordSuccess(Date.now() - startedAt);
    pushState();
    return response;
  });

  ipcMain.handle("rewrite:selection", async () => rewriteSelection());
  ipcMain.handle("preview:accept", async () => acceptPreview());
  ipcMain.handle("preview:cancel", async () => cancelPreview());
  ipcMain.handle("preview:regenerate", async () => regeneratePreview());
  ipcMain.handle("screen:capture", async () => {
    try {
      const snapshot = await screenContext.capture();
      pushState();
      return { ok: true, snapshot };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Screen capture failed.";
      notify("Screen context failed", message);
      pushState();
      return { ok: false, error: message };
    }
  });
  ipcMain.handle("screen:clear", async () => {
    screenContext.clear();
    pushState();
    return { ok: true };
  });

  ipcMain.handle("shell:openExternal", async (_event, url: string) => {
    await shell.openExternal(url);
  });
}

async function rewriteSelection(): Promise<{ ok: true } | { ok: false; error: string }> {
  const settings = store.get();
  const startedAt = Date.now();

  try {
    const selection = await captureSelectedText();
    if (!selection.selectedText) {
      throw new Error("No selected text found.");
    }

    const windowContext = await getActiveWindowContext();
    const context = buildContext(
      windowContext,
      selection.selectedText,
      selection.previousClipboardText,
      settings,
      browserBridge.getLatest(),
      ideBridge.getLatest(),
      screenContext.getLatest()
    );
    if (isAppDenied(context, effectiveAppDenylist(settings))) {
      throw new Error("This app or window is on your denylist.");
    }

    const request = buildCompileRequest(selection.selectedText, context, settings);

    const response = await compilePrompt(settings, request);
    store.setLastReceipt(toReceipt(response));

    if (settings.previewEnabled) {
      pendingPreview = {
        id: randomUUID(),
        roughPrompt: selection.selectedText,
        optimizedPrompt: response.optimized_prompt,
        mode: settings.promptMode,
        optimizationMode: settings.optimizationMode,
        context,
        contextReceipt: toReceipt(response),
        previousClipboardText: selection.previousClipboardText,
        restoreClipboard: settings.restoreClipboard,
        request
      };
      mainWindow?.show();
      notify("Preview ready", "Review the optimized prompt before replacing your selection.");
      pushState();
      return { ok: true };
    }

    await pasteReplacement(response.optimized_prompt, selection.previousClipboardText, settings.restoreClipboard);
    addHistory(selection.selectedText, response.optimized_prompt, response, settings);
    store.recordSuccess(Date.now() - startedAt);
    notify("Prompt rewritten", `${settings.optimizationMode === "speed" ? "Speed" : "Quality"} mode finished.`);
    pushState();
    return { ok: true };
  } catch (error) {
    store.recordFailure();
    const message = error instanceof Error ? error.message : "Rewrite failed.";
    notify("Rewrite failed", message);
    pushState();
    return { ok: false, error: message };
  }
}

async function acceptPreview(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!pendingPreview) {
    return { ok: false, error: "No preview is waiting." };
  }

  const startedAt = Date.now();
  const preview = pendingPreview;
  const settings = store.get();

  try {
    await pasteReplacement(preview.optimizedPrompt, preview.previousClipboardText, preview.restoreClipboard);
    addHistory(preview.roughPrompt, preview.optimizedPrompt, preview.contextReceipt, settings);
    store.recordSuccess(Date.now() - startedAt);
    pendingPreview = null;
    notify("Prompt replaced", "Preview accepted.");
    pushState();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not accept preview.";
    store.recordFailure();
    notify("Preview failed", message);
    pushState();
    return { ok: false, error: message };
  }
}

async function cancelPreview(): Promise<{ ok: true }> {
  if (pendingPreview) {
    store.recordCanceledPreview();
  }
  pendingPreview = null;
  pushState();
  return { ok: true };
}

async function regeneratePreview(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!pendingPreview) {
    return { ok: false, error: "No preview is waiting." };
  }

  try {
    const settings = store.get();
    const response = await compilePrompt(settings, {
      ...pendingPreview.request,
      optimization_mode: settings.optimizationMode,
      mode: settings.promptMode,
      custom_mode: resolveCustomMode(settings)
    });
    pendingPreview = {
      ...pendingPreview,
      optimizedPrompt: response.optimized_prompt,
      mode: settings.promptMode,
      optimizationMode: settings.optimizationMode,
      contextReceipt: toReceipt(response)
    };
    store.setLastReceipt(toReceipt(response));
    store.recordRegeneratedPreview();
    pushState();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not regenerate preview.";
    notify("Regenerate failed", message);
    return { ok: false, error: message };
  }
}

function buildContext(
  windowContext: PromptContext,
  selectedText: string,
  previousClipboardText: string,
  settings: AppSettings,
  browserContext = browserBridge.getLatest(),
  ideContext = ideBridge.getLatest(),
  screenSnapshot = screenContext.getLatest()
): PromptContext {
  const base: PromptContext = {
    ...windowContext,
    selected_text: selectedText,
    visible_text: settings.screenContextEnabled ? screenSnapshot?.text : null,
    clipboard_text: settings.clipboardContextEnabled ? previousClipboardText : null,
    browser_url: settings.browserContextEnabled ? browserContext?.url : null,
    browser_title: settings.browserContextEnabled ? browserContext?.title : null,
    browser_hostname: settings.browserContextEnabled ? browserContext?.hostname : null,
    browser_selection: settings.browserContextEnabled ? browserContext?.selectedText : null,
    browser_focused_text: settings.browserContextEnabled ? browserContext?.focusedText : null,
    browser_visible_text: settings.browserContextEnabled ? browserContext?.visibleText : null,
    ide_editor: settings.ideContextEnabled ? ideContext?.editor : null,
    ide_workspace: settings.ideContextEnabled ? ideContext?.workspaceName : null,
    ide_file_path: settings.ideContextEnabled ? ideContext?.filePath : null,
    ide_relative_file_path: settings.ideContextEnabled ? ideContext?.relativeFilePath : null,
    ide_language_id: settings.ideContextEnabled ? ideContext?.languageId : null,
    ide_selection: settings.ideContextEnabled ? ideContext?.selectedText : null,
    ide_visible_text: settings.ideContextEnabled ? ideContext?.visibleText : null,
    ide_diagnostics: settings.ideContextEnabled ? ideContext?.diagnostics : null,
    ide_git_diff: settings.ideContextEnabled ? ideContext?.gitDiff : null
  };
  const detectedTarget = detectTargetTool(base);
  return {
    ...base,
    detected_target: detectedTarget
  };
}

function buildCompileRequest(roughPrompt: string, context: PromptContext, settings: AppSettings): CompilePromptRequest {
  return {
    rough_prompt: roughPrompt,
    mode: settings.promptMode,
    optimization_mode: settings.optimizationMode,
    context,
    custom_mode: resolveCustomMode(settings)
  };
}

function resolveCustomMode(settings: AppSettings): CustomPromptModeInput | undefined {
  if (settings.promptMode !== "custom" || !settings.activeCustomModeId) {
    return undefined;
  }

  const customMode = findCustomMode(settings, settings.activeCustomModeId);
  if (!customMode) {
    return undefined;
  }

  return {
    name: customMode.name,
    instructions: customMode.instructions
  };
}

function toReceipt(source: CompilePromptResponse | ContextReceipt): ContextReceipt {
  return {
    context_used: source.context_used,
    warnings: source.warnings,
    model: source.model,
    latency_ms: source.latency_ms,
    route_mode: source.route_mode,
    route_target: source.route_target,
    route_pattern: source.route_pattern,
    route_failure_mode: source.route_failure_mode,
    used_fallback: source.used_fallback,
    timed_out: source.timed_out,
    routing_latency_ms: source.routing_latency_ms,
    backend_latency_ms: source.backend_latency_ms,
    context_source_count: source.context_source_count,
    context_char_count: source.context_char_count,
    output_char_count: source.output_char_count
  };
}

function addHistory(
  roughPrompt: string,
  optimizedPrompt: string,
  source: CompilePromptResponse | ContextReceipt,
  settings: AppSettings
): HistoryRecord[] {
  return store.addHistory({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    mode: settings.promptMode,
    optimizationMode: settings.optimizationMode,
    roughPrompt,
    optimizedPrompt,
    contextReceipt: toReceipt(source)
  });
}

function pushState(): void {
  mainWindow?.webContents.send("state:changed", dashboardState());
}

function dashboardState() {
  return toDashboardState(
    store.get(),
    backendHealthy,
    registeredHotkey,
    registeredPreviewHotkey,
    pendingPreview ? stripPendingPreview(pendingPreview) : null,
    store.historySnapshot(),
    store.lastReceiptSnapshot(),
    browserBridge.getLatest(),
    ideBridge.getLatest(),
    screenContext.getLatest(),
    screenContext.isBusy(),
    {
      port: browserBridge.port,
      running: browserBridge.running
    },
    {
      port: ideBridge.port,
      running: ideBridge.running
    }
  );
}

function stripPendingPreview(preview: typeof pendingPreview): PendingPreview | null {
  if (!preview) return null;
  return {
    id: preview.id,
    roughPrompt: preview.roughPrompt,
    optimizedPrompt: preview.optimizedPrompt,
    mode: preview.mode,
    optimizationMode: preview.optimizationMode,
    context: preview.context,
    contextReceipt: preview.contextReceipt
  };
}

function notify(title: string, body: string): void {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}
