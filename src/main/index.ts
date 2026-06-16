import { app, BrowserWindow, Menu, Notification, Tray, globalShortcut, ipcMain, nativeImage, shell } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compilePrompt, checkBackend } from "./backendClient";
import { SettingsStore, toDashboardState } from "./settings";
import { captureSelectedText, getActiveWindowContext, pasteReplacement } from "./textReplacement";
import type { AppSettings, CompilePromptRequest } from "../shared/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let store: SettingsStore;
let backendHealthy = false;
let registeredHotkey = false;

app.whenReady().then(async () => {
  store = new SettingsStore();
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
});

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 760,
    height: 560,
    minWidth: 680,
    minHeight: 520,
    show: false,
    title: "Shakespeare",
    backgroundColor: "#f8f5ef",
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
  pushState();
}

function registerIpc(): void {
  ipcMain.handle("state:get", async () => {
    backendHealthy = await checkBackend(store.get());
    return toDashboardState(store.get(), backendHealthy, registeredHotkey);
  });

  ipcMain.handle("settings:update", async (_event, patch: Partial<AppSettings>) => {
    store.update(patch);
    backendHealthy = await checkBackend(store.get());
    registerConfiguredHotkey();
    return toDashboardState(store.get(), backendHealthy, registeredHotkey);
  });

  ipcMain.handle("backend:check", async () => {
    backendHealthy = await checkBackend(store.get());
    pushState();
    return backendHealthy;
  });

  ipcMain.handle("compile:sample", async (_event, roughPrompt: string) => {
    const settings = store.get();
    const startedAt = Date.now();
    const response = await compilePrompt(settings, {
      rough_prompt: roughPrompt,
      mode: settings.promptMode,
      optimization_mode: settings.optimizationMode,
      context: { active_app: "Shakespeare dashboard", selected_text: roughPrompt }
    });
    store.recordSuccess(Date.now() - startedAt);
    pushState();
    return response;
  });

  ipcMain.handle("rewrite:selection", async () => rewriteSelection());

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
    const request: CompilePromptRequest = {
      rough_prompt: selection.selectedText,
      mode: settings.promptMode,
      optimization_mode: settings.optimizationMode,
      context: {
        ...windowContext,
        selected_text: selection.selectedText
      }
    };

    const response = await compilePrompt(settings, request);
    await pasteReplacement(response.optimized_prompt, selection.previousClipboardText, settings.restoreClipboard);
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

function pushState(): void {
  mainWindow?.webContents.send("state:changed", toDashboardState(store.get(), backendHealthy, registeredHotkey));
}

function notify(title: string, body: string): void {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}
