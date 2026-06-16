# Shakespeare IDE Context Extension

This local VS Code/Cursor extension sends bounded editor context to the Shakespeare desktop app on `127.0.0.1:8792`.

It captures:

- Editor name, workspace name, workspace folders, active file path, and language.
- Selected code.
- Visible code from the active editor.
- Diagnostics for the active file.
- A bounded `git diff` for the active file when available.

The desktop app ignores this data unless `IDE context` is enabled in Shakespeare.

## Install Locally

1. Start the Shakespeare Electron app.
2. In VS Code or Cursor, open the Command Palette.
3. Run `Developer: Install Extension from Location...`.
4. Select this folder:

```text
/Users/shreshth/Documents/Shakespeare/integrations/vscode
```

5. Enable `IDE context` in the Shakespeare dashboard.

## Commands

- `Shakespeare: Refresh IDE Context` sends the active editor context immediately.

## Settings

- `shakespeare.bridgeUrl`: local bridge endpoint. Default: `http://127.0.0.1:8792/v1/ide-context`.
- `shakespeare.autoSend`: refresh context when editor state changes. Default: `true`.
- `shakespeare.includeGitDiff`: include a bounded active-file diff. Default: `true`.
- `shakespeare.maxVisibleCharacters`: visible editor text cap before the desktop app applies its own caps.
