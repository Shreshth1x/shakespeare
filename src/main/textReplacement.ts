import { clipboard } from "electron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface SelectionCapture {
  selectedText: string;
  previousClipboardText: string;
}

export async function captureSelectedText(): Promise<SelectionCapture> {
  const previousClipboardText = clipboard.readText();
  await sendShortcut("copy");
  await wait(140);
  const selectedText = clipboard.readText().trim();

  return {
    selectedText,
    previousClipboardText
  };
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

async function sendShortcut(kind: "copy" | "paste"): Promise<void> {
  if (process.platform === "darwin") {
    const key = kind === "copy" ? "c" : "v";
    await execFileAsync("/usr/bin/osascript", [
      "-e",
      `tell application "System Events" to keystroke "${key}" using command down`
    ]);
    return;
  }

  if (process.platform === "win32") {
    const key = kind === "copy" ? "^c" : "^v";
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
