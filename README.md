# Shakespeare

Shakespeare is a cross-platform prompt compiler: a lightweight Electron app that rewrites rough prompts into fast, agent-ready instructions from anywhere on macOS or Windows.

The source-of-truth product spec is [CONTEXT_AWARE_PROMPT_COMPILER_PRD.md](CONTEXT_AWARE_PROMPT_COMPILER_PRD.md).

## Local Development

Install dependencies:

```bash
npm install
```

Run the backend with Doppler-managed secrets:

```bash
doppler run -- npm run dev:backend
```

Run the Electron app in another terminal:

```bash
npm run dev:app
```

Or run both together:

```bash
doppler run -- npm run dev
```

For local UI work without an OpenAI key, set `SHAKESPEARE_MOCK_MODEL=true` in the backend environment.

## Current Product Slice

- Global rewrite hotkey with Speed/Quality modes.
- Editable hotkey, preview hotkey, and backend URL.
- Focused-field rewrite fallback: click inside an editable field and press the rewrite hotkey when no text is selected.
- Optional preview-before-replace flow with accept, regenerate, and cancel.
- Custom prompt modes with local saved instructions.
- Local team policy import for shared modes and admin-locked privacy controls.
- Privacy controls for clipboard context, screen context, local history, and clipboard restoration.
- App/window denylist to prevent context capture in sensitive surfaces.
- Context receipt showing model, latency, context sources, and warnings.
- Local-only prompt history when explicitly enabled.
- Browser extension bridge for ChatGPT, Claude, Gemini, Gmail, Slack, Notion, Linear, and GitHub context, with optional native messaging.
- Manual local screen OCR capture that stores only extracted text and uses it only when `Screen context` is enabled.
- zsh input-buffer integration for rewriting the current terminal prompt in place.
- VS Code/Cursor extension bridge for active file, selected code, visible code, diagnostics, and git diff context.
- Latency-optimized Speed router with deterministic local classification, compact model packets, pattern-specific fallbacks, and route metadata.

## Browser Context Extension

The unpacked Chrome/Arc/Edge extension lives in `browser-extension/`.

1. Start the Electron app so the local browser bridge is listening on `127.0.0.1:8791`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Load unpacked extension from `browser-extension/`.
5. In Shakespeare, enable `Browser context` in the Privacy panel.

Optional native messaging host:

1. After loading the unpacked extension, copy its extension ID from `chrome://extensions`.
2. Install the local native messaging host:

```bash
npm run install:native-browser-host -- --browser chrome --extension-id <extension-id>
```

Use `--browser edge` for Microsoft Edge. The extension tries native messaging first and falls back to `127.0.0.1:8791` if the native host is not installed.

The extension sends bounded page context to the local desktop app only:

- URL, title, and hostname.
- Current browser selection.
- Focused input/contenteditable text.
- Focused input/contenteditable replacement commands when `Focused field rewrite` is enabled.
- Bounded visible page text from the main page area.

The desktop app ignores this data unless `Browser context` or `Focused field rewrite` is enabled.

## IDE Context Extension

The local VS Code/Cursor extension lives in `integrations/vscode/`.

1. Start the Electron app so the local IDE bridge is listening on `127.0.0.1:8792`.
2. In VS Code or Cursor, run `Developer: Install Extension from Location...`.
3. Select `integrations/vscode/`.
4. In Shakespeare, enable `IDE context` in the Privacy panel.

The extension sends bounded editor context to the local desktop app only:

- Editor and workspace name.
- Active file path and language.
- Selected code and visible editor text.
- Active-file diagnostics.
- Bounded active-file `git diff`, when available.

The desktop app ignores this data unless `IDE context` is enabled.

## Team Policy

The dashboard can import a local team policy JSON file shape. This is the no-Supabase path for shared modes and admin privacy controls:

```json
{
  "teamName": "Platform Team",
  "sharedModes": [
    {
      "id": "review",
      "name": "Review",
      "instructions": "Rewrite as a bug-focused code review prompt."
    }
  ],
  "privacyControls": {
    "focusedFieldRewriteEnabled": { "value": true, "locked": false },
    "screenContextEnabled": { "value": false, "locked": true },
    "localHistoryEnabled": { "value": false, "locked": true }
  },
  "appDenylist": ["1Password"],
  "lockAppDenylist": false
}
```

Locked privacy controls override local settings. Shared modes appear alongside local custom modes.

## Terminal / zsh Integration

The zsh widget lives in `integrations/shell/shakespeare.zsh`.

Add this to `~/.zshrc`:

```bash
source /Users/shreshth/Documents/Shakespeare/integrations/shell/shakespeare.zsh
```

Then restart your shell. While editing a terminal prompt, press:

```text
Ctrl-X Ctrl-P
```

The widget sends the current zsh `BUFFER` to the Shakespeare backend and replaces the buffer with the optimized prompt.

Optional environment overrides:

```bash
export SHAKESPEARE_BACKEND_URL=http://127.0.0.1:8787
export SHAKESPEARE_PROMPT_MODE=coding_agent
export SHAKESPEARE_OPTIMIZATION_MODE=speed
export SHAKESPEARE_ZSH_KEY='^X^P'
```

You can also use the CLI directly:

```bash
printf 'fix this failing auth test' | npx shakespeare-compile
```

## PowerShell Integration

The Windows PowerShell/Windows Terminal widget lives in `integrations/powershell/ShakespearePrompt.ps1`.

Add this to your PowerShell profile:

```powershell
. "C:\path\to\shakespeare\integrations\powershell\ShakespearePrompt.ps1"
```

Then restart PowerShell. While editing a terminal prompt, press:

```text
Ctrl+x,Ctrl+p
```

The widget sends the current PSReadLine buffer to the Shakespeare backend and replaces the buffer with the optimized prompt.

Optional environment overrides:

```powershell
$env:SHAKESPEARE_BACKEND_URL = "http://127.0.0.1:8787"
$env:SHAKESPEARE_PROMPT_MODE = "coding_agent"
$env:SHAKESPEARE_OPTIMIZATION_MODE = "speed"
$env:SHAKESPEARE_POWERSHELL_KEY = "Ctrl+x,Ctrl+p"
```

## Required Backend Secrets

```bash
OPENAI_API_KEY=
OPENAI_MODEL_SPEED=gpt-5.4-nano
OPENAI_MODEL_QUALITY=gpt-5.4-mini
SHAKESPEARE_CLIENT_TOKEN=
PORT=8787
SHAKESPEARE_FAST_ROUTER=true
SHAKESPEARE_SPEED_MODEL_TIMEOUT_MS=1200
```

`SHAKESPEARE_CLIENT_TOKEN` is only required when the backend is not localhost-only.

Speed mode uses the latency-optimized router by default. The router classifies the request locally, builds a compact model packet, prepares a deterministic fallback immediately, and lets the model result win only if it returns inside the deadline. Set `SHAKESPEARE_FAST_ROUTER=false` to temporarily return to the legacy compiler path.

For local testing without a provider key, set `SHAKESPEARE_MOCK_MODEL=true` or leave `OPENAI_API_KEY` unset; Speed mode will still return a pattern-specific local router fallback with route metadata.

Router smoke eval:

```bash
npm run eval:router
```

## Release Packaging

Local unpacked builds:

```bash
npm run package
npm run qa:package
```

Installer builds:

```bash
npm run dist
```

The app uses `electron-builder` with a real app icon, macOS hardened runtime entitlements, macOS notarization support, and an assisted Windows NSIS installer. Cross-platform package checks run in `.github/workflows/desktop-ci.yml` on macOS 14 and Windows latest.

Public distribution requires signing credentials:

- macOS: Apple Developer Program membership, a Developer ID Application certificate, and notarization credentials. Prefer App Store Connect API credentials through `APPLE_API_KEY`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`.
- Windows: a code-signing certificate exposed to electron-builder through `CSC_LINK` and `CSC_KEY_PASSWORD`, or the team's Windows signing provider.
- Backend: use Doppler for the backend project; do not bake provider keys into the Electron app.

Manual release coverage is tracked in [QA_MATRIX.md](QA_MATRIX.md).

## Verification

```bash
npm run typecheck
npm test
npm run check:syntax
npm run build
npm run package
npm run qa:package
```
