#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HOST_NAME = "com.shakespeare.promptcompiler";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const hostScriptPath = resolve(repoRoot, "scripts/native-browser-host.mjs");

const options = parseArgs(process.argv.slice(2));

if (!options.extensionId) {
  usage("Missing --extension-id.");
}

const browser = options.browser ?? "chrome";
if (browser !== "chrome" && browser !== "edge") {
  usage("--browser must be chrome or edge.");
}
const manifest = {
  name: HOST_NAME,
  description: "Shakespeare browser context native messaging host.",
  path: hostPathForPlatform(browser),
  type: "stdio",
  allowed_origins: [`chrome-extension://${options.extensionId}/`]
};

const manifestPath = manifestPathForBrowser(browser);
mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

if (process.platform !== "win32") {
  chmodSync(hostScriptPath, 0o755);
} else {
  registerWindowsHost(browser, manifestPath);
}

console.log(`Installed ${HOST_NAME} native messaging manifest for ${browser}.`);
console.log(manifestPath);

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--browser") {
      parsed.browser = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--extension-id") {
      parsed.extensionId = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--manifest-dir") {
      parsed.manifestDir = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      usage();
    }
  }
  return parsed;
}

function usage(error) {
  if (error) {
    console.error(error);
  }
  console.error(
    "Usage: node scripts/install-native-browser-host.mjs --browser chrome|edge --extension-id <extension-id> [--manifest-dir <path>]"
  );
  process.exit(error ? 1 : 0);
}

function hostPathForPlatform(browser) {
  if (process.platform !== "win32") {
    return hostScriptPath;
  }

  const wrapperPath = join(nativeHostBaseDir(browser), "shakespeare-native-browser-host.cmd");
  mkdirSync(dirname(wrapperPath), { recursive: true });
  writeFileSync(wrapperPath, `@echo off\r\n"${process.execPath}" "${hostScriptPath}"\r\n`);
  return wrapperPath;
}

function manifestPathForBrowser(browser) {
  return join(nativeHostBaseDir(browser), `${HOST_NAME}.json`);
}

function nativeHostBaseDir(browser) {
  if (options.manifestDir) {
    return resolve(options.manifestDir);
  }

  if (process.platform === "darwin") {
    if (browser === "edge") {
      return join(homedir(), "Library/Application Support/Microsoft Edge/NativeMessagingHosts");
    }
    return join(homedir(), "Library/Application Support/Google/Chrome/NativeMessagingHosts");
  }

  if (process.platform === "linux") {
    if (browser === "edge") {
      return join(homedir(), ".config/microsoft-edge/NativeMessagingHosts");
    }
    return join(homedir(), ".config/google-chrome/NativeMessagingHosts");
  }

  if (process.platform === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData/Roaming"), "Shakespeare/NativeMessagingHosts");
  }

  usage(`Unsupported platform: ${process.platform}`);
}

function registerWindowsHost(browser, manifestPath) {
  const keyRoot =
    browser === "edge"
      ? "HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts"
      : "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts";
  execFileSync("reg", ["add", `${keyRoot}\\${HOST_NAME}`, "/ve", "/t", "REG_SZ", "/d", manifestPath, "/f"], {
    stdio: "inherit"
  });
}
