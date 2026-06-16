import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AppSettings, DashboardState } from "../shared/types";

const DEFAULT_SETTINGS: AppSettings = {
  hotkey: "CommandOrControl+Shift+P",
  backendUrl: "http://127.0.0.1:8787",
  clientToken: "",
  promptMode: "coding_agent",
  optimizationMode: "speed",
  restoreClipboard: true,
  stats: {
    promptsEnhanced: 0,
    acceptedRewrites: 0,
    failedRewrites: 0,
    totalLatencyMs: 0,
    estimatedTimeSavedMs: 0
  }
};

export class SettingsStore {
  private readonly filePath: string;
  private settings: AppSettings;

  constructor() {
    this.filePath = join(app.getPath("userData"), "settings.json");
    this.settings = this.load();
  }

  get(): AppSettings {
    return structuredClone(this.settings);
  }

  update(patch: Partial<AppSettings>): AppSettings {
    this.settings = {
      ...this.settings,
      ...patch,
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
      estimatedTimeSavedMs: stats.estimatedTimeSavedMs + 45_000
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

  private load(): AppSettings {
    if (!existsSync(this.filePath)) {
      return DEFAULT_SETTINGS;
    }

    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<AppSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        stats: {
          ...DEFAULT_SETTINGS.stats,
          ...(parsed.stats ?? {})
        }
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2));
  }
}

export function toDashboardState(
  settings: AppSettings,
  backendHealthy: boolean,
  registeredHotkey: boolean
): DashboardState {
  return {
    settings,
    backendHealthy,
    registeredHotkey,
    platform: process.platform,
    permissions: {
      accessibility: process.platform === "darwin" ? "unknown" : "not_required",
      screen: "disabled"
    }
  };
}
