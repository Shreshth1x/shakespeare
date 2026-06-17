import type { AppSettings, CustomPromptMode, PrivacyControlKey, TeamPolicy, TeamPrivacyControl } from "./types.js";

export const PRIVACY_CONTROL_LABELS: Record<PrivacyControlKey, string> = {
  previewEnabled: "Preview before replace",
  focusedFieldRewriteEnabled: "Focused field rewrite",
  clipboardContextEnabled: "Clipboard context",
  screenContextEnabled: "Screen context",
  browserContextEnabled: "Browser context",
  ideContextEnabled: "IDE context",
  localHistoryEnabled: "Local history",
  restoreClipboard: "Restore clipboard"
};

const PRIVACY_KEYS = Object.keys(PRIVACY_CONTROL_LABELS) as PrivacyControlKey[];

export function normalizeCustomModes(input: unknown, maxModes = 12, fallbackPrefix = "custom"): CustomPromptMode[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const now = new Date().toISOString();

  return input
    .filter((item): item is Partial<CustomPromptMode> => Boolean(item) && typeof item === "object")
    .map((item, index) => {
      const rawId = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `${fallbackPrefix}-${index + 1}`;
      const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
      return {
        id,
        name: typeof item.name === "string" ? item.name.trim().slice(0, 80) : "",
        instructions: typeof item.instructions === "string" ? item.instructions.trim().slice(0, 1800) : "",
        createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now
      };
    })
    .filter((item) => {
      if (!item.id || !item.name || !item.instructions || seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    })
    .slice(0, maxModes);
}

export function normalizeTeamPolicy(input: unknown): TeamPolicy | null {
  if (!input || typeof input !== "object") return null;

  const policy = input as Partial<TeamPolicy>;
  const teamName = typeof policy.teamName === "string" && policy.teamName.trim() ? policy.teamName.trim().slice(0, 120) : "Team";
  const updatedAt = typeof policy.updatedAt === "string" ? policy.updatedAt : new Date().toISOString();
  const sharedModes = uniqueModes(
    normalizeCustomModes(policy.sharedModes, 24, "team-mode").map((mode) => ({
      ...mode,
      id: mode.id.startsWith("team-") ? mode.id : `team-${mode.id}`
    }))
  );
  const privacyControls = normalizePrivacyControls(policy.privacyControls);
  const appDenylist = normalizeStringList(policy.appDenylist, 60);

  if (!sharedModes.length && !Object.keys(privacyControls).length && !appDenylist.length) {
    return null;
  }

  return {
    teamName,
    updatedAt,
    sharedModes,
    privacyControls,
    appDenylist,
    lockAppDenylist: Boolean(policy.lockAppDenylist)
  };
}

export function applyTeamPolicy(settings: AppSettings): AppSettings {
  const policy = settings.teamPolicy;
  if (!policy) return settings;

  const next = { ...settings };
  for (const key of PRIVACY_KEYS) {
    const control = policy.privacyControls[key];
    if (control?.locked) {
      next[key] = control.value;
    }
  }

  if (settings.promptMode === "custom" && settings.activeCustomModeId && !findCustomMode(next, settings.activeCustomModeId)) {
    next.promptMode = "coding_agent";
    next.activeCustomModeId = null;
  }

  return next;
}

export function findCustomMode(settings: AppSettings, id: string): CustomPromptMode | null {
  return (
    settings.customModes.find((mode) => mode.id === id) ??
    settings.teamPolicy?.sharedModes.find((mode) => mode.id === id) ??
    null
  );
}

export function effectiveAppDenylist(settings: AppSettings): string[] {
  return uniqueStrings([...(settings.teamPolicy?.appDenylist ?? []), ...settings.appDenylist]);
}

export function isPrivacyControlLocked(settings: AppSettings, key: PrivacyControlKey): boolean {
  return Boolean(settings.teamPolicy?.privacyControls[key]?.locked);
}

function normalizePrivacyControls(input: unknown): Partial<Record<PrivacyControlKey, TeamPrivacyControl>> {
  if (!input || typeof input !== "object") return {};
  const controls = input as Partial<Record<PrivacyControlKey, Partial<TeamPrivacyControl> | boolean>>;
  const normalized: Partial<Record<PrivacyControlKey, TeamPrivacyControl>> = {};

  for (const key of PRIVACY_KEYS) {
    const value = controls[key];
    if (typeof value === "boolean") {
      normalized[key] = {
        value,
        locked: true
      };
      continue;
    }

    if (value && typeof value === "object" && typeof value.value === "boolean") {
      normalized[key] = {
        value: value.value,
        locked: value.locked !== false
      };
    }
  }

  return normalized;
}

function normalizeStringList(input: unknown, maxItems: number): string[] {
  if (!Array.isArray(input)) return [];
  return uniqueStrings(input.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)).slice(
    0,
    maxItems
  );
}

function uniqueStrings(input: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of input) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}

function uniqueModes(input: CustomPromptMode[]): CustomPromptMode[] {
  const seen = new Set<string>();
  const output: CustomPromptMode[] = [];

  for (const mode of input) {
    if (seen.has(mode.id)) continue;
    seen.add(mode.id);
    output.push(mode);
  }

  return output;
}
