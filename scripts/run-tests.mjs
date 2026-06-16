#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const testDir = join(repoRoot, "test");
const testFiles = findTestFiles(testDir)
  .map((file) => relative(repoRoot, file))
  .sort();

if (!testFiles.length) {
  console.error("No test files found under test/.");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", "--import", "tsx", ...testFiles], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: false
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

function findTestFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTestFiles(path));
      continue;
    }
    if (entry.isFile() && (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.mjs"))) {
      files.push(path);
    }
  }

  return files;
}
