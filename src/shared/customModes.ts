import type { AppSettings, CustomPromptMode } from "./types.js";

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

export function findCustomMode(settings: AppSettings, id: string): CustomPromptMode | null {
  return settings.customModes.find((mode) => mode.id === id) ?? null;
}
