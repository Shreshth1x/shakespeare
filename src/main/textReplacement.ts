import { clipboard } from "electron";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const EDITABLE_AX_ROLES = new Set(["AXTextArea", "AXTextField", "AXSearchField", "AXComboBox"]);

export interface SelectionCapture {
  selectedText: string;
  previousClipboardText: string;
}

export type EditableTextSource = "selection" | "browser_focused_field" | "accessibility_focused_field" | "keyboard_focused_field" | "none";

export type ReplacementMethod = "clipboard_selection" | "browser_extension" | "accessibility_value" | "clipboard_focused_field" | "none";

export interface EditableTextCapture {
  text: string;
  previousClipboardText: string;
  source: EditableTextSource;
  replacementMethod: ReplacementMethod;
  focusedRole?: string;
  browserUrl?: string;
}

export interface EditableTextCaptureOptions {
  allowFocusedField: boolean;
  activeApp?: string | null;
  browserFocusedText?: string | null;
  browserFocusedTextTruncated?: boolean;
  browserUrl?: string | null;
}

interface FocusedAccessibilityInfo {
  role: string;
  subrole: string;
  value: string;
  editable: boolean;
}

export async function captureSelectedText(): Promise<SelectionCapture> {
  const previousClipboardText = clipboard.readText();
  const emptySelectionSentinel = `__SHAKESPEARE_EMPTY_SELECTION_${randomUUID()}__`;
  clipboard.writeText(emptySelectionSentinel);
  await wait(25);
  await sendShortcut("copy");
  await wait(140);
  const copiedText = clipboard.readText();
  const selectedText = copiedText === emptySelectionSentinel ? "" : copiedText.trim();

  if (!selectedText) {
    clipboard.writeText(previousClipboardText);
  }

  return {
    selectedText,
    previousClipboardText
  };
}

export async function captureEditableText(options: EditableTextCaptureOptions): Promise<EditableTextCapture> {
  const selection = await captureSelectedText();
  if (selection.selectedText) {
    return {
      text: selection.selectedText,
      previousClipboardText: selection.previousClipboardText,
      source: "selection",
      replacementMethod: "clipboard_selection"
    };
  }

  if (!options.allowFocusedField) {
    return emptyCapture(selection.previousClipboardText);
  }

  const browserFocusedText = options.browserFocusedText?.trim();
  if (
    browserFocusedText &&
    !options.browserFocusedTextTruncated &&
    isLikelyBrowserApp(options.activeApp)
  ) {
    return {
      text: browserFocusedText,
      previousClipboardText: selection.previousClipboardText,
      source: "browser_focused_field",
      replacementMethod: "browser_extension",
      browserUrl: options.browserUrl ?? undefined
    };
  }

  const accessibilityCapture = await captureFocusedTextByAccessibility(selection.previousClipboardText);
  if (accessibilityCapture.text) {
    return accessibilityCapture;
  }

  const keyboardCapture = await captureFocusedTextByKeyboard(selection.previousClipboardText);
  if (keyboardCapture.text) {
    return keyboardCapture;
  }

  return emptyCapture(selection.previousClipboardText);
}

export async function pasteReplacement(text: string, previousClipboardText: string, restoreClipboard: boolean): Promise<void> {
  clipboard.writeText(text);
  await wait(40);
  await sendShortcut("paste");
  await wait(220);

  if (restoreClipboard) {
    clipboard.writeText(previousClipboardText);
  }
}

/**
 * Paste a rewrite into a terminal/TUI (e.g. Claude Code) where there is no selectable or
 * accessible text field. The unified rewrite flow has already sent Ctrl+C while probing for a
 * selection, which clears the TUI's draft line, so this only pastes — sending another Ctrl+C
 * here risks tripping the terminal's "press Ctrl+C twice to exit". The rewrite is left on the
 * clipboard so the user can paste it manually if the terminal swallows the paste.
 */
export async function replaceTerminalInput(text: string): Promise<void> {
  clipboard.writeText(text);
  await wait(60);
  await sendShortcut("paste");
  await wait(220);
}

export async function replaceCapturedText(
  capture: EditableTextCapture,
  text: string,
  restoreClipboard: boolean,
  options: {
    replaceBrowserFocusedText?: (text: string, capture: EditableTextCapture) => Promise<boolean>;
  } = {}
): Promise<void> {
  if (capture.replacementMethod === "browser_extension" && options.replaceBrowserFocusedText) {
    const replaced = await options.replaceBrowserFocusedText(text, capture);
    if (replaced) return;

    await replaceFocusedFieldByKeyboard(text, capture.previousClipboardText, restoreClipboard);
    return;
  }

  if (capture.replacementMethod === "accessibility_value") {
    try {
      await replaceFocusedTextByAccessibility(text);
      return;
    } catch {
      await replaceFocusedFieldByKeyboard(text, capture.previousClipboardText, restoreClipboard);
      return;
    }
  }

  if (capture.replacementMethod === "clipboard_focused_field") {
    await pasteReplacement(text, capture.previousClipboardText, restoreClipboard);
    return;
  }

  await pasteReplacement(text, capture.previousClipboardText, restoreClipboard);
}

export async function getActiveWindowContext(): Promise<{ active_app?: string; window_title?: string }> {
  if (process.platform === "darwin") {
    try {
      const script = [
        'tell application "System Events"',
        "set frontApp to first application process whose frontmost is true",
        "set appName to name of frontApp",
        "set windowName to \"\"",
        "try",
        "set windowName to name of first window of frontApp",
        "end try",
        "return appName & \"\\n\" & windowName",
        "end tell"
      ].join("\n");
      const { stdout } = await execFileAsync("/usr/bin/osascript", ["-e", script], { timeout: 600 });
      const [activeApp, windowTitle] = stdout.trim().split("\n");
      return {
        active_app: activeApp || undefined,
        window_title: windowTitle || undefined
      };
    } catch {
      return {};
    }
  }

  if (process.platform === "win32") {
    return { active_app: "Windows" };
  }

  return {};
}

export function isEditableAccessibilityRole(role: string | null | undefined): boolean {
  return Boolean(role && EDITABLE_AX_ROLES.has(role));
}

function emptyCapture(previousClipboardText: string): EditableTextCapture {
  return {
    text: "",
    previousClipboardText,
    source: "none",
    replacementMethod: "none"
  };
}

async function captureFocusedTextByAccessibility(previousClipboardText: string): Promise<EditableTextCapture> {
  const info = await getFocusedAccessibilityInfo();
  const text = info?.value.trim() ?? "";
  if (!info?.editable || !text) {
    return emptyCapture(previousClipboardText);
  }

  return {
    text,
    previousClipboardText,
    source: "accessibility_focused_field",
    replacementMethod: "accessibility_value",
    focusedRole: info.role
  };
}

async function captureFocusedTextByKeyboard(previousClipboardText: string): Promise<EditableTextCapture> {
  const info = await getFocusedAccessibilityInfo();
  if (!info?.editable) {
    return emptyCapture(previousClipboardText);
  }

  const emptySelectionSentinel = `__SHAKESPEARE_EMPTY_FOCUSED_FIELD_${randomUUID()}__`;
  clipboard.writeText(emptySelectionSentinel);
  await wait(25);
  await sendShortcut("selectAll");
  await wait(60);
  await sendShortcut("copy");
  await wait(140);

  const copiedText = clipboard.readText();
  const text = copiedText === emptySelectionSentinel ? "" : copiedText.trim();
  if (!text) {
    clipboard.writeText(previousClipboardText);
    return emptyCapture(previousClipboardText);
  }

  return {
    text,
    previousClipboardText,
    source: "keyboard_focused_field",
    replacementMethod: "clipboard_focused_field",
    focusedRole: info.role
  };
}

async function replaceFocusedFieldByKeyboard(text: string, previousClipboardText: string, restoreClipboard: boolean): Promise<void> {
  const info = await getFocusedAccessibilityInfo();
  if (!info?.editable) {
    throw new Error("No focused editable text field found.");
  }

  await sendShortcut("selectAll");
  await wait(60);
  await pasteReplacement(text, previousClipboardText, restoreClipboard);
}

async function getFocusedAccessibilityInfo(): Promise<FocusedAccessibilityInfo | null> {
  if (process.platform !== "darwin") return null;

  try {
    const script = [
      'tell application "System Events"',
      "set frontApp to first application process whose frontmost is true",
      "set targetElement to value of attribute \"AXFocusedUIElement\" of frontApp",
      "set roleValue to value of attribute \"AXRole\" of targetElement",
      "set subroleValue to \"\"",
      "try",
      "set subroleValue to value of attribute \"AXSubrole\" of targetElement",
      "end try",
      "set fieldValue to \"\"",
      "try",
      "set fieldValue to value of attribute \"AXValue\" of targetElement",
      "end try",
      "return (roleValue as text) & \"\\n\" & (subroleValue as text) & \"\\n\" & (fieldValue as text)",
      "end tell"
    ].join("\n");
    const { stdout } = await execFileAsync("/usr/bin/osascript", ["-e", script], { timeout: 900 });
    const [role = "", subrole = "", ...valueLines] = stdout.replace(/\r/g, "").split("\n");
    const value = valueLines.join("\n").trimEnd();
    return {
      role,
      subrole,
      value,
      editable: isEditableAccessibilityRole(role)
    };
  } catch {
    return null;
  }
}

async function replaceFocusedTextByAccessibility(text: string): Promise<void> {
  if (process.platform !== "darwin") {
    throw new Error(`Focused-field replacement is not implemented for ${process.platform}.`);
  }

  const script = [
    "on run argv",
    "set replacementText to item 1 of argv",
    'tell application "System Events"',
    "set frontApp to first application process whose frontmost is true",
    "set targetElement to value of attribute \"AXFocusedUIElement\" of frontApp",
    "set roleValue to value of attribute \"AXRole\" of targetElement",
    "if roleValue is not in {\"AXTextArea\", \"AXTextField\", \"AXSearchField\", \"AXComboBox\"} then error \"Focused element is not editable.\"",
    "set value of attribute \"AXValue\" of targetElement to replacementText",
    "end tell",
    "end run"
  ].join("\n");

  await execFileAsync("/usr/bin/osascript", ["-e", script, text], { timeout: 1200 });
}

function isLikelyBrowserApp(appName: string | null | undefined): boolean {
  if (!appName) return false;
  return /\b(Arc|Chrome|Chromium|Brave|Microsoft Edge|Edge|Vivaldi|Opera)\b/i.test(appName);
}

async function sendShortcut(kind: "copy" | "paste" | "selectAll"): Promise<void> {
  if (process.platform === "darwin") {
    const key = kind === "copy" ? "c" : kind === "paste" ? "v" : "a";
    await execFileAsync("/usr/bin/osascript", [
      "-e",
      `tell application "System Events" to keystroke "${key}" using command down`
    ]);
    return;
  }

  if (process.platform === "win32") {
    const key = kind === "copy" ? "^c" : kind === "paste" ? "^v" : "^a";
    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-Command",
      `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${key}')`
    ]);
    return;
  }

  throw new Error(`Text replacement is not implemented for ${process.platform}.`);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
