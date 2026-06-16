#!/usr/bin/env node

import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const releaseDir = join(repoRoot, "release");

const requiredBuildAssets = [
  "build/icon.icns",
  "build/icon.ico",
  "build/entitlements.mac.plist",
  "build/entitlements.mac.inherit.plist"
];

for (const asset of requiredBuildAssets) {
  assertExists(join(repoRoot, asset), `Missing release asset: ${asset}`);
}

assertExists(releaseDir, "Missing release directory. Run npm run package first.");

if (process.platform === "darwin") {
  const appBundle = findMacAppBundle();
  assertExists(join(appBundle, "Contents/MacOS/Shakespeare"), "Packaged macOS app is missing its executable.");
  assertExists(join(appBundle, "Contents/Resources/app.asar"), "Packaged macOS app is missing app.asar.");
  console.log(`Package smoke passed: ${relative(appBundle)}`);
} else if (process.platform === "win32") {
  const unpackedDir = join(releaseDir, "win-unpacked");
  assertExists(join(unpackedDir, "Shakespeare.exe"), "Packaged Windows app is missing Shakespeare.exe.");
  assertExists(join(unpackedDir, "resources/app.asar"), "Packaged Windows app is missing app.asar.");
  console.log(`Package smoke passed: ${relative(unpackedDir)}`);
} else {
  console.log(`Package smoke skipped for unsupported platform: ${process.platform}`);
}

function findMacAppBundle() {
  const candidates = readdirSync(releaseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("mac"))
    .map((entry) => join(releaseDir, entry.name, "Shakespeare.app"));

  const appBundle = candidates.find((candidate) => existsSync(candidate));
  if (!appBundle) {
    throw new Error("Packaged macOS app bundle was not found under release/mac*.");
  }
  return appBundle;
}

function assertExists(path, message) {
  if (!existsSync(path)) {
    throw new Error(message);
  }
}

function relative(path) {
  return path.replace(`${repoRoot}/`, "");
}
