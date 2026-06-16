#!/usr/bin/env node

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8787";

export function parseArgs(argv) {
  const options = {
    backendUrl: process.env.SHAKESPEARE_BACKEND_URL || DEFAULT_BACKEND_URL,
    token: process.env.SHAKESPEARE_CLIENT_TOKEN || "",
    mode: process.env.SHAKESPEARE_PROMPT_MODE || "coding_agent",
    optimizationMode: process.env.SHAKESPEARE_OPTIMIZATION_MODE || "speed",
    activeApp: process.env.SHAKESPEARE_ACTIVE_APP || "terminal",
    windowTitle: process.env.SHAKESPEARE_WINDOW_TITLE || process.cwd(),
    json: false,
    fallbackOriginal: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--backend" && next) {
      options.backendUrl = next;
      index += 1;
    } else if (arg === "--token" && next) {
      options.token = next;
      index += 1;
    } else if (arg === "--mode" && next) {
      options.mode = next;
      index += 1;
    } else if ((arg === "--optimization" || arg === "--optimization-mode") && next) {
      options.optimizationMode = next;
      index += 1;
    } else if (arg === "--active-app" && next) {
      options.activeApp = next;
      index += 1;
    } else if (arg === "--window-title" && next) {
      options.windowTitle = next;
      index += 1;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--no-fallback") {
      options.fallbackOriginal = false;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }

  return options;
}

export function buildCompileRequest(input, options) {
  return {
    rough_prompt: input.trim(),
    mode: options.mode,
    optimization_mode: options.optimizationMode,
    context: {
      active_app: options.activeApp,
      window_title: options.windowTitle,
      selected_text: input.trim(),
      detected_target: "Terminal"
    }
  };
}

export async function compileText(input, options) {
  const response = await fetch(`${trimSlash(options.backendUrl)}/v1/compile-prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: JSON.stringify(buildCompileRequest(input, options))
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || `Backend failed with ${response.status}`);
  }

  return body;
}

export async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function helpText() {
  return `Usage: shakespeare-compile [options] < rough-prompt.txt

Options:
  --backend <url>              Backend URL. Defaults to SHAKESPEARE_BACKEND_URL or ${DEFAULT_BACKEND_URL}
  --token <token>              Client token. Defaults to SHAKESPEARE_CLIENT_TOKEN
  --mode <mode>                general | coding_agent | debugging | research
  --optimization <mode>        speed | quality | max_quality
  --active-app <name>          Context active app label
  --window-title <title>       Context window/title label
  --json                       Print full backend JSON
  --no-fallback                Exit nonzero instead of printing original text on failure
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(helpText());
    return;
  }

  const input = await readStdin();
  if (!input.trim()) {
    return;
  }

  try {
    const result = await compileText(input, options);
    process.stdout.write(options.json ? `${JSON.stringify(result, null, 2)}\n` : result.optimized_prompt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (!options.fallbackOriginal) {
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
      return;
    }
    process.stderr.write(`Shakespeare compile failed, keeping original input: ${message}\n`);
    process.stdout.write(input);
  }
}

function trimSlash(value) {
  return value.replace(/\/+$/, "");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
