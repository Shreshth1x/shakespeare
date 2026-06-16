import type { PromptContext } from "./types.js";

const TARGET_PATTERNS: Array<{ target: string; patterns: RegExp[] }> = [
  { target: "Claude Code", patterns: [/claude code/i] },
  { target: "Codex", patterns: [/\bcodex\b/i] },
  { target: "Cursor", patterns: [/\bcursor\b/i] },
  { target: "VS Code", patterns: [/visual studio code/i, /\bvs code\b/i, /\bcode\b/i] },
  { target: "ChatGPT", patterns: [/chatgpt/i] },
  { target: "Claude", patterns: [/claude\.ai/i, /\bclaude\b/i] },
  { target: "Gemini", patterns: [/gemini/i] },
  { target: "Warp", patterns: [/\bwarp\b/i] },
  { target: "iTerm", patterns: [/\biterm\b/i] },
  { target: "Windows Terminal", patterns: [/windows terminal/i, /powershell/i] },
  { target: "Slack", patterns: [/\bslack\b/i] },
  { target: "Gmail", patterns: [/\bgmail\b/i] },
  { target: "Linear", patterns: [/\blinear\b/i] },
  { target: "GitHub", patterns: [/\bgithub\b/i] },
  { target: "Notion", patterns: [/\bnotion\b/i] }
];

export function detectTargetTool(context: PromptContext): string | null {
  const haystack = [context.active_app, context.window_title, context.browser_hostname, context.browser_title, context.browser_url]
    .filter(Boolean)
    .join(" ");
  if (!haystack) return null;

  for (const candidate of TARGET_PATTERNS) {
    if (candidate.patterns.some((pattern) => pattern.test(haystack))) {
      return candidate.target;
    }
  }

  return null;
}

export function isAppDenied(context: PromptContext, denylist: string[]): boolean {
  const haystack = [context.active_app, context.window_title].filter(Boolean).join(" ").toLowerCase();
  if (!haystack) return false;

  return denylist.some((entry) => {
    const normalized = entry.trim().toLowerCase();
    return normalized.length > 0 && haystack.includes(normalized);
  });
}
