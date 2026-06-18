# Shakespeare QA Matrix

This matrix tracks the MVP surfaces from `CONTEXT_AWARE_PROMPT_COMPILER_PRD.md`.

## Automated Release Checks

| Check | Command | Coverage |
| --- | --- | --- |
| TypeScript typecheck | `npm run typecheck` | Main, preload, renderer, backend, shared modules. |
| Unit/integration tests | `npm test` | Prompt compiler, app detection, screen OCR filtering, browser bridge, IDE bridge, native host, team policy, CLI. |
| Script syntax | `npm run check:syntax` | Browser extension scripts, native messaging scripts, package smoke script, VS Code/Cursor extension. |
| Local package smoke | `npm run package` then `npm run qa:package` | Verifies app icon assets, entitlements, platform package output, executable, and `app.asar`. |
| Cross-platform CI | `.github/workflows/desktop-ci.yml` | Runs typecheck, tests, syntax, packaging, and package smoke on macOS 14 and Windows latest. |

## Manual MVP Surface Matrix

| Surface | macOS Status | Windows Status | Expected Behavior |
| --- | --- | --- | --- |
| Install and launch | Ready for local package smoke | Covered by CI package smoke | App launches from packaged build and shows dashboard. |
| Global hotkey | Manual QA required | Manual QA required | Hotkey rewrites selected text or reports a clear failure. |
| Native text editor | Manual QA required in TextEdit/Notes | Manual QA required in Notepad | Selected text is copied, rewritten, and replaced inline. |
| Browser chat | Browser bridge implemented; manual ChatGPT/Claude QA required | Browser bridge implemented; manual ChatGPT/Claude QA required | Selected prompt is rewritten with optional browser context when enabled. |
| VS Code/Cursor | IDE bridge implemented; manual extension QA required | IDE bridge implemented; manual extension QA required | Selected text is rewritten and IDE context appears in context receipt when enabled. |
| Terminal | zsh integration implemented | PowerShell PSReadLine integration implemented; manual Windows Terminal QA required | Current prompt buffer is rewritten where shell integration is installed. |
| Clipboard preservation | Covered by tests and manual app flow | Covered by tests and manual app flow | Original clipboard is restored when the setting is enabled. |
| Privacy controls | Covered by tests and UI manual QA | Covered by tests and UI manual QA | Clipboard, screen, browser, IDE, and history context stay disabled unless enabled. |
| Speed latency | Instrumented in dashboard | Instrumented in dashboard | Speed mode should stay under 2 seconds p95 for selected-text-only prompts with a warm backend. |

## Release Credential Checklist

| Platform | Required Before Public Release |
| --- | --- |
| macOS | Apple Developer Program membership, Developer ID Application certificate, and notarization credentials through `APPLE_API_KEY`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`, or an equivalent Apple notarization profile. |
| Windows | Code-signing certificate available to electron-builder through `CSC_LINK` and `CSC_KEY_PASSWORD`, or the team's Windows signing provider. |
| Backend | Doppler-managed backend project with `OPENAI_API_KEY`, `OPENAI_MODEL_SPEED`, `OPENAI_MODEL_QUALITY`, optional `SHAKESPEARE_CLIENT_TOKEN`, and `PORT`. |
