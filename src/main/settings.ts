import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { normalizeCustomModes } from "../shared/customModes";
import type {
  AppSettings,
  BrowserContextSnapshot,
  ContextReceipt,
  DashboardState,
  HistoryRecord,
  IdeContextSnapshot,
  PendingPreview,
  PromptMode,
  ScreenContextSnapshot
} from "../shared/types";

const DEFAULT_SETTINGS: AppSettings = {
  hotkey: "CommandOrControl+Shift+P",
  previewHotkey: "CommandOrControl+Shift+Enter",
  backendUrl: "http://127.0.0.1:8787",
  clientToken: "",
  promptMode: "coding_agent",
  activeCustomModeId: null,
  customModes: [],
  optimizationMode: "speed",
  restoreClipboard: true,
  previewEnabled: false,
  focusedFieldRewriteEnabled: true,
  clipboardContextEnabled: false,
  screenContextEnabled: false,
  browserContextEnabled: false,
  ideContextEnabled: false,
  localHistoryEnabled: false,
  appDenylist: [],
  stats: {
    promptsEnhanced: 0,
    acceptedRewrites: 0,
    failedRewrites: 0,
    totalLatencyMs: 0,
    estimatedTimeSavedMs: 0,
    regeneratedPreviews: 0,
    canceledPreviews: 0
  }
};

interface StoreFile {
  settings: AppSettings;
  history: HistoryRecord[];
  lastReceipt: ContextReceipt | null;
}

export class SettingsStore {
  private readonly filePath: string;
  private settings: AppSettings;
  private history: HistoryRecord[];
  private lastReceipt: ContextReceipt | null;

  constructor() {
    this.filePath = join(app.getPath("userData"), "settings.json");
    const data = this.load();
    this.settings = data.settings;
    this.history = data.history;
    this.lastReceipt = data.lastReceipt;
  }

  get(): AppSettings {
    return structuredClone(this.settings);
  }

  update(patch: Partial<AppSettings>): AppSettings {
    const customModes = normalizeCustomModes(patch.customModes ?? this.settings.customModes);
    const activeCustomModeId = normalizeActiveCustomModeId(
      patch.activeCustomModeId !== undefined ? patch.activeCustomModeId : this.settings.activeCustomModeId,
      customModes
    );
    const promptMode = normalizePromptMode(patch.promptMode ?? this.settings.promptMode, activeCustomModeId);
    this.settings = {
      ...this.settings,
      ...patch,
      promptMode: promptMode === "custom" && !activeCustomModeId ? DEFAULT_SETTINGS.promptMode : promptMode,
      activeCustomModeId,
      customModes,
      appDenylist: patch.appDenylist ?? this.settings.appDenylist,
      stats: {
        ...this.settings.stats,
        ...(patch.stats ?? {})
      }
    };
    this.save();
    return this.get();
  }

  recordSuccess(latencyMs: number): AppSettings {
    const stats = this.settings.stats;
    this.settings.stats = {
      promptsEnhanced: stats.promptsEnhanced + 1,
      acceptedRewrites: stats.acceptedRewrites + 1,
      failedRewrites: stats.failedRewrites,
      totalLatencyMs: stats.totalLatencyMs + latencyMs,
      estimatedTimeSavedMs: stats.estimatedTimeSavedMs + 45_000,
      regeneratedPreviews: stats.regeneratedPreviews,
      canceledPreviews: stats.canceledPreviews
    };
    this.save();
    return this.get();
  }

  recordFailure(): AppSettings {
    const stats = this.settings.stats;
    this.settings.stats = {
      ...stats,
      failedRewrites: stats.failedRewrites + 1
    };
    this.save();
    return this.get();
  }

  recordRegeneratedPreview(): AppSettings {
    this.settings.stats = {
      ...this.settings.stats,
      regeneratedPreviews: this.settings.stats.regeneratedPreviews + 1
    };
    this.save();
    return this.get();
  }

  recordCanceledPreview(): AppSettings {
    this.settings.stats = {
      ...this.settings.stats,
      canceledPreviews: this.settings.stats.canceledPreviews + 1
    };
    this.save();
    return this.get();
  }

  addHistory(record: HistoryRecord): HistoryRecord[] {
    if (this.settings.localHistoryEnabled) {
      this.history = [record, ...this.history].slice(0, 25);
      this.save();
    }
    return this.historySnapshot();
  }

  historySnapshot(): HistoryRecord[] {
    return structuredClone(this.history);
  }

  setLastReceipt(receipt: ContextReceipt | null): ContextReceipt | null {
    this.lastReceipt = receipt ? structuredClone(receipt) : null;
    this.save();
    return this.lastReceiptSnapshot();
  }

  lastReceiptSnapshot(): ContextReceipt | null {
    return this.lastReceipt ? structuredClone(this.lastReceipt) : null;
  }

  private load(): StoreFile {
    if (!existsSync(this.filePath)) {
      return {
        settings: DEFAULT_SETTINGS,
        history: [],
        lastReceipt: null
      };
    }

    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<StoreFile> & Partial<AppSettings>;
      const rawSettings = parsed.settings ?? parsed;
      const customModes = normalizeCustomModes(rawSettings.customModes);
      const activeCustomModeId = normalizeActiveCustomModeId(rawSettings.activeCustomModeId, customModes);
      const promptMode = normalizePromptMode(rawSettings.promptMode, activeCustomModeId);
      return {
        settings: {
          ...DEFAULT_SETTINGS,
          ...rawSettings,
          promptMode,
          activeCustomModeId,
          customModes,
          appDenylist: rawSettings.appDenylist ?? DEFAULT_SETTINGS.appDenylist,
          stats: {
            ...DEFAULT_SETTINGS.stats,
            ...(rawSettings.stats ?? {})
          }
        },
        history: Array.isArray(parsed.history) ? parsed.history.slice(0, 25) : [],
        lastReceipt: parsed.lastReceipt ?? null
      };
    } catch {
      return {
        settings: DEFAULT_SETTINGS,
        history: [],
        lastReceipt: null
      };
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(
      this.filePath,
      JSON.stringify(
        {
          settings: this.settings,
          history: this.history,
          lastReceipt: this.lastReceipt
        },
        null,
        2
      )
    );
  }
}

function normalizeActiveCustomModeId(input: unknown, customModes: AppSettings["customModes"]): string | null {
  if (typeof input !== "string" || !input.trim()) return null;
  const id = input.trim();
  return customModes.some((mode) => mode.id === id) ? id : null;
}

function normalizePromptMode(input: unknown, activeCustomModeId: string | null): PromptMode {
  if (input === "custom") {
    return activeCustomModeId ? "custom" : DEFAULT_SETTINGS.promptMode;
  }

  if (input === "general" || input === "coding_agent" || input === "debugging" || input === "research") {
    return input;
  }

  return DEFAULT_SETTINGS.promptMode;
}

export function toDashboardState(
  settings: AppSettings,
  backendHealthy: boolean,
  registeredHotkey: boolean,
  registeredPreviewHotkey: boolean,
  pendingPreview: PendingPreview | null,
  history: HistoryRecord[],
  lastReceipt: ContextReceipt | null,
  browserContext: BrowserContextSnapshot | null,
  ideContext: IdeContextSnapshot | null,
  screenContext: ScreenContextSnapshot | null,
  screenContextBusy: boolean,
  browserBridge: { port: number; running: boolean },
  ideBridge: { port: number; running: boolean }
): DashboardState {
  return {
    settings,
    backendHealthy,
    registeredHotkey,
    registeredPreviewHotkey,
    pendingPreview,
    history,
    lastReceipt,
    browserContext,
    ideContext,
    screenContext,
    screenContextBusy,
    browserBridge,
    ideBridge,
    platform: process.platform,
    permissions: {
      accessibility: process.platform === "darwin" ? "unknown" : "not_required",
      screen: settings.screenContextEnabled ? "unknown" : "disabled"
    }
  };
}
