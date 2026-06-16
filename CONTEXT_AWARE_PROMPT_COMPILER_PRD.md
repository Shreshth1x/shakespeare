# Shakespeare PRD: Context-Aware Prompt Compiler

## 1. Summary

Shakespeare is a cross-platform Electron desktop utility for macOS and Windows that turns rough user intent into an optimized prompt for the AI tool the user is already using. The user types or speaks a messy prompt in any text box, terminal, browser chat, coding agent, or editor, presses a global hotkey, and Shakespeare rewrites the draft in place using both the user's rough text and immediate on-screen context.

The product should feel like Willow Scribe or Wispr Flow Command Mode: fast, quiet, almost invisible, and extremely easy to use. Unlike voice-first tools, Shakespeare is prompt-first and aimed specifically at LLMs and coding agents.

Working positioning:

> The hotkey that turns vague intent plus current screen context into an agent-ready prompt.

The wedge is not generic writing polish. The wedge is prompt compilation for AI-heavy workflows, especially Claude Code, Codex, Cursor, ChatGPT, Claude, Warp, iTerm, VS Code, and browser-based AI tools.

## 2. Problem

People know what they want from an AI assistant, but they often send weak prompts:

- The prompt is too vague: "fix this", "make this better", "what's wrong here".
- The prompt misses obvious context visible on screen.
- The prompt omits success criteria, constraints, or desired output format.
- The prompt causes coding agents to overbuild, skip repo inspection, ignore tests, or make broad unrelated changes.
- The user wastes time reprompting, correcting scope, or manually writing mini-specs.

This is especially painful for agentic coding because the cost of a bad prompt is not just a bad answer. It can be wasted tokens, wrong files edited, broken local state, or a long detour.

## 3. Product Thesis

Prompt quality is becoming an operating-system-level workflow. The next useful layer is not another chat app. It is a lightweight transformation layer that sits over every place people already prompt AI.

The best version of Shakespeare:

- Works wherever the user is already typing on macOS and Windows.
- Requires one hotkey.
- Understands the immediate context on screen.
- Preserves intent without inventing facts.
- Produces prompts that are specific, scoped, and agent-friendly.
- Lets the user keep flow instead of switching to a prompt-builder app.
- Optimizes for speed by default, with quality as an explicit user choice.

## 4. Target Users

Primary:

- AI-native developers using Claude Code, Codex, Cursor, VS Code, Warp, iTerm, Ghostty, ChatGPT, Claude, and Gemini.
- Founders and operators who use AI tools all day and need cleaner task prompts.
- Power users already using voice dictation, Raycast, Wispr Flow, Willow, or Superwhisper.

Secondary:

- Product managers writing AI research, planning, and spec prompts.
- Analysts and consultants asking LLMs to summarize, compare, or draft.
- Support, sales, and operations users who need context-aware replies, but this is not the first wedge.

## 5. Core User Stories

### 5.1 Agent Prompt Rewrite

As a developer, I type "fix this auth bug" in Claude Code, highlight it, press the hotkey, and Shakespeare replaces it with a clear instruction that references the visible error, asks the agent to inspect relevant files first, make the narrowest fix, and run tests.

### 5.2 Screen-Aware Prompt Enhancement

As a user in ChatGPT or Claude, I type "summarize this and tell me what to do", press the hotkey, and Shakespeare uses the selected text, active window title, page title, and OCR/DOM context to rewrite the prompt into a structured request.

### 5.3 Terminal-First Prompt Compiler

As a developer inside a terminal coding agent, I select the rough prompt I just typed, press the hotkey, and Shakespeare replaces the selection without switching apps.

### 5.4 Context-Aware Reply Prompt

As a user looking at an email, Slack thread, GitHub issue, or Linear ticket, I type "draft a reply", press the hotkey, and Shakespeare rewrites it into a complete LLM prompt that includes the visible thread context and asks for the right tone and format.

## 6. Non-Goals

For the first build, Shakespeare is not:

- A full voice transcription product.
- A chat client.
- A general Grammarly competitor.
- A prompt marketplace.
- A full coding agent.
- A browser automation agent.
- A tool that silently sends screenshots or clipboard content without explicit user permission.

Voice input can come later. The first wedge is keyboard-first prompt enhancement with optional screen context.

## 7. Product Principles

- Stay in flow: the user should not leave the app they are in.
- Preserve intent: rewrite and structure, but do not add unsupported claims.
- Use context conservatively: screen context should clarify, not hallucinate.
- Make privacy visible: show what context types are enabled and allow per-app blocking.
- Optimize for agents: include scope, constraints, repo inspection, output format, and verification when appropriate.
- Be reversible: every replacement should be undoable.
- Be fast enough to become habit: target 1 to 2 seconds from hotkey press to pasted replacement for normal prompts.
- Prefer speed over maximum prompt quality by default. Users can opt into quality mode when they are willing to wait longer.
- Keep the dashboard extremely simple: one obvious hotkey, one obvious mode control, and a tiny set of useful stats.

## 8. MVP Scope

### 8.1 MVP Definition

The MVP is an Electron tray/menu-bar app for macOS and Windows with a global hotkey that rewrites selected text in place using a fixed prompt compiler instruction.

MVP context sources:

- Selected text.
- Active app name.
- Active window title, when accessible.
- Optional clipboard content.
- Optional user-selected mode.

MVP output:

- Replace selected text with optimized prompt.
- Show a small toast on success or failure.
- Preserve clipboard contents when possible.
- Allow Undo through the host app's native undo stack.

### 8.2 P0 Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| R-001 | User can use a managed backend model key loaded from Doppler; BYO API key can be added later as an advanced option. | P0 |
| R-002 | User can choose a global hotkey during onboarding. | P0 |
| R-003 | App can capture selected text through a cross-platform copy-selection fallback and OS-specific accessibility helpers where available. | P0 |
| R-004 | App can fall back to simulated copy/paste with clipboard restoration when direct selected-text access fails. | P0 |
| R-005 | App sends the rough prompt plus basic context to an LLM. | P0 |
| R-006 | App replaces the selected text with the optimized prompt. | P0 |
| R-007 | App shows a non-intrusive status indicator: enhancing, success, failed, or permission needed. | P0 |
| R-008 | App has a simple Willow-style dashboard/settings window for hotkey, speed/quality mode, privacy toggles, backend status, and lightweight usage stats. | P0 |
| R-009 | App never sends screenshot, OCR, clipboard, or browser context unless that source is enabled. | P0 |
| R-010 | App supports at least three prompt modes: General, Coding Agent, and Debugging. | P0 |
| R-011 | Default optimization mode uses the fastest configured model and must target 1 to 2 seconds end-to-end for selected-text-only rewrites. | P0 |

### 8.3 P1 Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| R-012 | Preview mode shows before/after diff before replacement. | P1 |
| R-013 | User can press a second hotkey to accept preview, cancel, or regenerate. | P1 |
| R-014 | App stores local-only history if enabled. | P1 |
| R-015 | User can define custom prompt modes. | P1 |
| R-016 | App detects likely target tool from active app/window, such as Claude Code, Codex, Cursor, ChatGPT, Claude, Gmail, Slack, or Linear. | P1 |
| R-017 | App can add visible screen OCR context from the active window. | P1 |
| R-018 | App shows a context receipt: selected text, app name, window title, clipboard, OCR, browser context. | P1 |
| R-019 | Dashboard shows prompts enhanced, average latency, accepted rewrites, undo/regenerate rate, and estimated time saved. | P1 |

### 8.4 P2 Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| R-020 | Browser extension provides clean DOM/page/thread context for ChatGPT, Claude, Gemini, Gmail, Slack, Notion, Linear, GitHub, and Google Docs. | P2 |
| R-021 | Terminal integration can read and replace the current input buffer in supported shells or terminal apps. | P2 |
| R-022 | VS Code/Cursor extension can provide selected code, active file path, diagnostics, and git diff context. | P2 |
| R-023 | Team version supports shared modes and admin privacy controls. | P2 |

## 9. UX Flow

### 9.1 First Launch

1. User opens Shakespeare.
2. App explains the core behavior in one sentence.
3. User grants the minimum OS permissions needed for inline replacement.
4. User chooses hotkey.
5. User chooses Speed mode or Quality mode, with Speed selected by default.
6. User confirms the backend connection or configures an optional BYO model provider.
7. User runs a test rewrite in a sample text field.

### 9.2 Inline Rewrite

1. User types a rough prompt anywhere.
2. User highlights the prompt.
3. User presses hotkey.
4. Shakespeare captures selected text and enabled context.
5. Shakespeare calls the fastest configured model by default.
6. Shakespeare replaces the selected text.
7. User presses Enter in the original app.

### 9.5 Dashboard

The dashboard should feel closer to Willow than an admin console: minimal, calm, and instantly understandable.

P0 dashboard:

- Large hotkey display.
- Single mode control: Speed or Quality.
- Backend/model status.
- Permission status by platform.
- Big primary action: "Try rewrite".
- Tiny stats row: prompts enhanced, average latency, accepted rewrites, estimated time saved.

P0 should avoid charts, complex tables, team management, prompt libraries, and marketing copy. The dashboard exists to reassure the user that the app is working and to make the hotkey/mode/privacy settings easy to change.

Dashboard design requirements:

- One compact window, not a full admin panel.
- First visible elements: hotkey, active mode, and enabled/disabled state.
- Stats should be lightweight and motivational, not financial-report precise.
- Primary stats: prompts enhanced, average rewrite time, estimated time saved, accepted rewrites.
- Optional stat: estimated reprompts avoided.
- Avoid "tokens saved" as a primary claim because optimized prompts may be longer; if token information is shown later, label it as tokens processed or estimated token delta.
- No charts in P0.
- No prompt-content feed unless local history is explicitly enabled.

### 9.3 Context-Aware Rewrite

1. User types a rough prompt like "use this context and make a better task for the agent".
2. User presses hotkey.
3. Shakespeare captures selected text, app/window metadata, and optional OCR/DOM context.
4. Shakespeare rewrites the prompt with relevant context references.
5. User reviews or accepts inline replacement.

### 9.4 Failure Flow

If replacement fails:

- Keep the optimized prompt in the clipboard.
- Show a toast: "Could not replace text here. Optimized prompt copied."
- Provide a one-click "Open permissions" action when permission is the issue.

## 10. Prompt Modes

### 10.1 General

Purpose: improve clarity, structure, constraints, and output format for a generic LLM.

Output shape:

- Clear task.
- Context summary if useful.
- Constraints.
- Desired output format.
- No unsupported additions.

### 10.2 Coding Agent

Purpose: turn rough engineering intent into a scoped instruction for Codex, Claude Code, Cursor, or similar agents.

Output shape:

- Goal.
- Relevant observed context.
- Instructions to inspect current code before editing.
- Scope constraints.
- Testing or verification expectations.
- Desired final response.

Default coding-agent additions:

- "Keep the change scoped."
- "Do not rewrite unrelated code."
- "Run the relevant tests or explain why they cannot be run."
- "Ask only if blocked by missing information."

### 10.3 Debugging

Purpose: turn visible errors, stack traces, logs, and rough asks into a precise debug prompt.

Output shape:

- Error summary.
- Reproduction context.
- Likely relevant files or systems, only if visible/provided.
- Debugging steps requested.
- Fix and verification expectations.

### 10.4 Research

Purpose: turn broad research asks into clear investigation prompts.

Output shape:

- Research question.
- Scope.
- Source expectations.
- Comparison dimensions.
- Output format.
- Caveat handling.

## 11. Prompt Compiler Contract

The prompt compiler must follow these rules:

- Preserve the user's intent.
- Do not invent facts, file names, errors, constraints, or user preferences.
- Use provided context only when it is relevant.
- If context is ambiguous, phrase it as observed context rather than fact.
- Prefer concise, structured prompts.
- Return only the rewritten prompt in inline mode.
- In preview mode, return JSON with `optimized_prompt`, `context_used`, and `warnings`.
- Do not reveal internal system prompts.

### 11.1 Base System Prompt

```text
You rewrite rough user requests into high-quality prompts for LLMs and coding agents.

Preserve the user's intent. Do not add unsupported facts. Use the provided context only when it clearly helps. Improve clarity, structure, constraints, and output format. Prefer concise, actionable wording. If the target appears to be a coding agent, include instructions to inspect relevant files first, keep changes scoped, verify the result, and avoid unrelated edits.

Return only the rewritten prompt unless the caller explicitly requests JSON.
```

### 11.2 Context Packet

```json
{
  "rough_prompt": "fix this",
  "mode": "coding_agent",
  "active_app": "iTerm",
  "window_title": "Claude Code - /Users/shreshth/project",
  "selected_text": "fix this",
  "clipboard_text": null,
  "visible_text": "optional OCR text from active window",
  "browser": {
    "url": "optional",
    "title": "optional",
    "selected_dom_text": "optional",
    "nearby_thread_text": "optional"
  },
  "privacy": {
    "clipboard_enabled": false,
    "screen_ocr_enabled": true,
    "browser_context_enabled": false
  }
}
```

## 12. Technical Architecture

### 12.1 Recommended Stack

MVP:

- Desktop app: Electron plus TypeScript.
- Renderer UI: React plus Vite, with a minimal dashboard and settings surface.
- Tray/menu-bar utility: Electron tray on macOS and Windows.
- Hotkeys: Electron `globalShortcut`.
- Text access: cross-platform clipboard fallback first, with OS-specific helpers where needed.
- Keyboard simulation: native helper layer using macOS CGEvent/AppleScript where necessary and Windows SendInput/UI Automation where necessary.
- Clipboard fallback: save clipboard, simulate copy, read selected text, set optimized prompt, simulate paste, then restore clipboard when safe.
- Local app secrets: OS credential storage through a package such as `keytar`, backed by Keychain on macOS and Credential Manager on Windows.
- Local settings/history: local SQLite or lightweight JSON/SQLite store; history remains off by default.
- Backend proxy: small TypeScript service that exposes `POST /v1/compile-prompt`.
- Backend secrets: Doppler, using the backend project's existing config.
- LLM: provider abstraction using the OpenAI Responses API first, with Anthropic/Gemini-compatible adapters later if useful.
- Packaging: `electron-builder` for signed macOS and Windows builds.

V1:

- Screen capture: Electron `desktopCapturer` plus OS-specific permission handling.
- OCR: platform-specific local OCR where possible: Apple Vision on macOS, Windows OCR APIs or a local OCR library on Windows.
- Privacy UI: per-context-source toggles and app denylist.

V2:

- Browser extension: Manifest V3 extension for Chrome/Arc/Edge, later Safari if needed.
- Native app messaging: browser extension sends context to the Electron app.
- Shell/terminal integration: zsh widget, optional wrappers for `claude`, `codex`, and similar CLIs.
- IDE integration: VS Code/Cursor extension for selected code, diagnostics, active file, and git diff.

### 12.2 Infrastructure and External Services

P0 infrastructure should stay intentionally small:

| Tool or Service | Use in P0? | Purpose | Notes |
| --- | --- | --- | --- |
| Electron | Yes | Cross-platform desktop shell for macOS and Windows. | Core app runtime. |
| TypeScript | Yes | Shared app/backend language. | Use strict mode. |
| React + Vite | Yes | Dashboard/settings renderer. | Keep UI extremely small. |
| Electron `globalShortcut` | Yes | Global hotkey. | Avoid low-level key logging. |
| Native keyboard/clipboard helper | Yes | Copy selected text and paste optimized prompt into the active app. | Use OS-specific implementations behind one interface. |
| `keytar` or equivalent | Yes | Store backend URL/client token and optional BYO provider keys. | Uses OS credential stores. |
| `electron-builder` | Yes | Package macOS and Windows apps. | Signing/notarization can come after local MVP. |
| TypeScript backend | Yes | Model-key proxy and prompt compilation endpoint. | Recommended so the OpenAI key stays server-side instead of shipping in the desktop app. |
| Doppler | Yes | Backend secret management. | Use the backend project/config; run backend commands through `doppler run`. |
| OpenAI API | Yes | First model provider for prompt compilation. | Default Speed mode should use `gpt-5.4-nano`; Quality mode should use `gpt-5.4-mini`; allow overrides through Doppler. |
| SQLite or local app data store | Yes | Local settings and optional local-only history. | No cloud database needed for MVP. |
| Supabase | No | Not needed for MVP. | Add only if accounts, sync, team modes, shared prompt history, or server-side audit logs become required. |
| Stripe | No | Paid subscription billing. | Add only when charging users. |
| Sentry | Optional | Crash/error reporting. | Keep prompt content out of error logs. |
| PostHog or analytics | Optional | Product usage metrics. | Avoid capturing prompt text or screen context. |
| Chrome Web Store | No | Browser extension distribution. | Needed only in the browser-extension phase. |
| Apple Developer Program | Not for local MVP | Developer ID signing/notarization for macOS distribution. | Required before public macOS distribution. |
| Windows code-signing certificate | Not for local MVP | Signed Windows installer. | Required for a polished public Windows release. |

### 12.3 Platform Behavior

The Electron app must expose one internal text-replacement interface with separate platform implementations.

macOS:

- Global hotkey via Electron.
- Selected-text capture through simulated `Cmd+C` fallback first.
- Paste through simulated `Cmd+V`.
- Optional native helper for Accessibility/CGEvent reliability.
- Required permission: Accessibility for controlling other apps.
- Screen context later requires Screen Recording permission.

Windows:

- Global hotkey via Electron.
- Selected-text capture through simulated `Ctrl+C` fallback first.
- Paste through simulated `Ctrl+V`.
- Optional native helper using SendInput/UI Automation for better reliability.
- Elevated/admin apps may not be controllable from a non-elevated Shakespeare process.
- Screen context later should use Electron capture or Windows capture APIs.

### 12.4 Backend Proxy

The backend exists for one reason in P0: keep the model provider key out of the Electron app.

Endpoint:

```text
POST /v1/compile-prompt
```

Request:

```json
{
  "rough_prompt": "fix this",
  "mode": "coding_agent",
  "context": {
    "active_app": "iTerm",
    "window_title": "Claude Code - /Users/shreshth/project",
    "selected_text": "fix this",
    "clipboard_text": null,
    "visible_text": null
  }
}
```

Response:

```json
{
  "optimized_prompt": "Investigate and fix the issue shown in the current terminal...",
  "context_used": ["selected_text", "active_app", "window_title"],
  "warnings": []
}
```

Required backend secrets:

| Secret | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | Calls the model provider. |
| `OPENAI_MODEL_SPEED` | Yes | Default fast rewrite model. Start with `gpt-5.4-nano`. |
| `OPENAI_MODEL_QUALITY` | Yes | Optional higher-quality rewrite model. Start with `gpt-5.4-mini`. |
| `OPENAI_MODEL` | Optional | Fallback model if mode-specific env vars are not set. |
| `SHAKESPEARE_CLIENT_TOKEN` | Yes if backend is not localhost-only | Simple bearer token used by the Electron app to call the backend during private alpha. |
| `PORT` | Optional | Backend port. Default can be `8787`. |
| `ANTHROPIC_API_KEY` | Optional | Future provider fallback. |
| `GEMINI_API_KEY` | Optional | Future provider fallback. |
| `SENTRY_DSN` | Optional | Backend error reporting. Must not include prompt payloads. |
| `POSTHOG_PROJECT_API_KEY` | Optional | Privacy-safe event analytics. Do not send prompt content. |

Explicitly not required for P0:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CLERK_SECRET_KEY`

Local development commands should use Doppler, for example:

```bash
doppler run -- npm run dev
doppler run -- npm test
doppler run -- npm run build
```

If the backend is placed in a monorepo package, use the backend package's normal command names but keep the same rule: secrets are environment-variable-only and loaded through Doppler.

### 12.5 Model and Latency Policy

Default behavior must optimize for speed, not maximum prompt sophistication.

Modes:

| Mode | Default model | Target use | End-to-end target |
| --- | --- | --- | --- |
| Speed | `gpt-5.4-nano` | Everyday inline prompt cleanup. | 1 to 2 seconds from hotkey to pasted text. |
| Quality | `gpt-5.4-mini` | More careful restructuring when the user can wait. | Under 3 seconds for selected-text-only prompts. |
| Max Quality | Latest stronger model, optional later. | Rare high-value prompts. | User explicitly accepts slower latency. |

Speed-mode backend constraints:

- One model request only.
- No multi-step chains.
- No web search.
- No screenshot/OCR unless the user explicitly uses context mode.
- Keep the stable system prompt short and cache-friendly.
- Put dynamic user context after the stable prompt prefix.
- Set `store: false` for privacy unless product requirements change.
- Use strict output limits, for example 250 to 500 output tokens.
- Return plain text for inline mode; avoid JSON unless preview/context receipt is enabled.
- Fail fast and copy original text back if the backend exceeds the latency timeout.

Model note:

OpenAI's current public docs position `gpt-5.4-mini` and `gpt-5.4-nano` as lower-latency, lower-cost choices, and OpenAI's prompt-caching docs note that stable prompt prefixes can reduce latency and cost. For Shakespeare, `gpt-5.4-nano` is the right default because the job is narrow: preserve intent and rewrite structure quickly. `gpt-5.4-mini` belongs behind the Quality toggle.

### 12.6 Supabase Decision

Do not add Supabase for the MVP.

Reasons:

- The first product can be stateless on the server.
- User settings can live locally on the Mac.
- Prompt history should be local-only and opt-in.
- The backend only needs to transform a request into one model call.
- Adding accounts, auth, row-level security, migrations, and cloud persistence would slow down the first useful build.

Supabase becomes useful if Shakespeare needs:

- User accounts across devices.
- Team/shared prompt modes.
- Cloud-synced prompt history.
- Billing entitlement state that must be checked server-side.
- Admin dashboards or audit logs.
- Browser extension identity shared with the Electron app.

If Supabase is introduced later, use checked-in migrations and a CLI-first workflow:

```bash
supabase migration new <name>
supabase db reset
supabase db push --dry-run
supabase db push
```

Until then, avoid creating a database dependency.

### 12.7 Main Components

| Component | Responsibility |
| --- | --- |
| Hotkey Listener | Detect global hotkey and trigger enhancement. |
| Context Collector | Gather selected text, app/window metadata, optional clipboard, optional OCR, optional browser context. |
| Privacy Filter | Apply user settings, app denylist, max token limits, and sensitive-source rules. |
| Prompt Compiler Client | Build context packet and call the backend proxy. |
| Replacement Engine | Replace selected text or copy result to clipboard as fallback. |
| Dashboard | Show hotkey, Speed/Quality mode, backend status, permission status, and minimal usage stats. |
| Preview UI | Optional diff/accept/cancel/regenerate overlay, off by default. |
| Settings | Hotkey, model mode, privacy, app-specific behavior. |

### 12.8 Context Capture Strategy

Order of reliability:

1. Browser/IDE extension context.
2. OS accessibility/UI automation selected text and focused field text.
3. Clipboard fallback.
4. Active window OCR.
5. Terminal visible text OCR.
6. Shell input-buffer integration.

Terminal caveat:

Normal desktop apps often expose selected text through copy-selection, accessibility, or UI automation paths. Terminals and TUIs are harder because the current input buffer may live inside the terminal process or shell. For the MVP, support terminal use by requiring the user to highlight the rough prompt before pressing the hotkey. Later, add shell widgets or CLI wrappers for true input-buffer access.

## 13. Privacy and Security

Default posture:

- Selected text is sent only when the user presses the hotkey.
- Clipboard context is off by default.
- Screen OCR is off by default in MVP and opt-in in V1.
- Browser DOM context is off until the extension is installed and enabled.
- Local history is off by default.
- App secrets are stored in the operating system credential store.
- The app provides a visible context receipt in preview mode.
- Users can denylist apps, domains, and window titles.

Sensitive-context handling:

- Do not capture password fields.
- Do not capture hidden browser inputs.
- Do not retain screenshots after OCR unless the user enables diagnostics.
- Warn before enabling clipboard or screen OCR globally.
- Add a "private mode" hotkey variant that uses only selected text.

## 14. Competitive Landscape

Research snapshot based on current public docs and listings.

| Product | What it does | Relevance | Gap Shakespeare can exploit |
| --- | --- | --- | --- |
| [Raycast AI Commands](https://manual.raycast.com/ai/ai-commands) | Runs reusable AI commands on selected text, focused fields, clipboard, current app, and other placeholders. Quick Fix can replace text in focused apps using Accessibility. | Strong adjacent OS-level AI layer. | Broad productivity layer, not specialized for context-aware agent prompting. |
| [PromptAI 360](https://www.promptai360.com/prompt-enhancer) | Chrome extension plus macOS app for prompt enhancement across ChatGPT, Claude, Gemini, Claude Code, Cursor, VS Code, Warp, Ghostty, iTerm, and any macOS input. | Direct competitor. | Shakespeare must beat it on context awareness, coding-agent presets, transparency, and workflow quality. |
| [Willow Scribe](https://help.willowvoice.com/en/articles/15043797-introduction-to-scribe-in-willow) | Voice-first writing assistant that can read on-screen context, draft replies, and rewrite selected text in place. | Strong adjacent product and UX reference. | Voice-first and general writing. Shakespeare can be keyboard-first and prompt-agent-specific. |
| [Wispr Flow Command Mode](https://docs.wisprflow.ai/articles/4816967992-how-to-use-command-mode) | Voice command mode that transforms highlighted text, rewrites inline, translates, or answers without a selection. | Adjacent voice/context workflow. | Not focused on agent prompt compilation as the core job. |
| [Superwhisper Context Awareness](https://superwhisper.com/docs/common-issues/context) | Dictation app with selected text, application context, and clipboard context; custom modes can enable different context sources. | Adjacent context architecture. | Voice dictation first, not a universal prompt compiler. |
| [Promptly Chrome Extension](https://chromewebstore.google.com/detail/promptly-%E2%80%93-ai-prompt-enha/jjfoaldlbbcfgkhbfmadjjelphbgmngg) | One-click prompt optimizer and prompt manager for ChatGPT, Claude, Gemini, and websites. | Direct web-chat competitor. | Browser-only surface; less native desktop and coding-agent depth. |
| [OpenAI Prompt Optimizer](https://developers.openai.com/api/docs/guides/prompt-optimizer) | Dashboard workflow for prompt optimization using datasets/evals. | Validates prompt optimization as a real workflow. | Not an inline OS hotkey or context-aware app. |

## 15. Differentiation

Shakespeare should not compete as "one more prompt enhancer." The differentiated product is:

1. Context-aware by design.
2. Coding-agent-first.
3. Inline and universal.
4. Privacy-explicit.
5. Built around prompt modes for real workflows, not a generic "make better" button.

Example differentiated output:

Rough prompt:

```text
fix this
```

Visible context:

```text
Claude Code terminal shows a failing auth callback test and a stack trace mentioning src/auth/session.ts.
```

Optimized prompt:

```text
Investigate and fix the failing auth callback test shown in the current terminal. Start by inspecting the relevant auth/session code and the failing test before editing. Keep the change narrowly scoped to the root cause, avoid unrelated refactors, and run the relevant test after the fix. In your final response, summarize the cause, the files changed, and the verification result.
```

## 16. Success Metrics

Activation:

- 60 percent of new users complete required permission setup.
- 50 percent successfully run first rewrite within 5 minutes.

Habit:

- Median active user runs at least 10 rewrites per week.
- 30 percent of active users use it in at least 3 apps.

Quality:

- 80 percent thumbs-up or no-revert rate on rewrites.
- Less than 10 percent immediate undo rate.
- Less than 5 percent "added unsupported context" reports.

Performance:

- Speed mode p50 hotkey-to-paste latency under 1.2 seconds.
- Speed mode p95 hotkey-to-paste latency under 2.0 seconds for selected-text-only prompts.
- Quality mode p95 hotkey-to-paste latency under 3.0 seconds for selected-text-only prompts.
- Median backend model call under 900 ms in Speed mode.
- Less than 5 percent timeout/fallback rate in target apps.

Dashboard:

- User can understand within 5 seconds whether the app is enabled, what hotkey to press, and which mode is active.
- Dashboard shows prompts enhanced, average latency, accepted rewrites, undo/regenerate rate, and estimated time saved.
- Dashboard avoids complex analytics, prompt-content logs, and token-saved claims that imply false precision.

Revenue signal:

- Individual users are likely viable at roughly $8 to $15 per month if the product saves repeated reprompting and failed-agent runs.
- Team pricing can be $15 to $30 per seat per month if shared coding-agent modes, privacy controls, and evals are added.

## 17. Scope and Difficulty

### Phase 0: Personal MVP

Time: 4 to 7 days.

Build:

- Electron tray app for macOS and Windows.
- Hotkey.
- Cross-platform selected text capture through copy-selection fallback.
- LLM rewrite.
- Paste replacement.
- Minimal dashboard with hotkey, mode, backend status, and usage stats.
- Settings for hotkey, Speed/Quality mode, backend URL/token, and privacy.
- General and Coding Agent modes.

Difficulty: medium. Most risk is cross-platform text replacement reliability and hitting the 1 to 2 second latency target.

### Phase 1: Usable Indie App

Time: 2 to 4 weeks.

Build:

- Better permissions onboarding.
- Preview/diff.
- Local history.
- Custom modes.
- Clipboard restoration.
- App-specific behavior.
- Error states.
- Signed installers for macOS and Windows if distributing beyond local testing.
- Basic telemetry if shipping commercially.

Difficulty: medium. The main work is polish and reliability across apps.

### Phase 2: Screen-Aware Scribe Mode

Time: 3 to 6 additional weeks.

Build:

- Active window screenshot.
- OCR with Apple Vision on macOS and Windows OCR/local OCR on Windows.
- Context receipt.
- App denylist.
- Context relevance filtering.
- Better prompt compiler that can cite observed context.

Difficulty: medium-high. OCR quality, privacy UX, and context relevance are the hard parts.

### Phase 3: App-Aware Context Layer

Time: 6 to 12 additional weeks.

Build:

- Chrome extension.
- Native messaging.
- ChatGPT/Claude/Gemini adapters.
- Gmail/Slack/Notion/Linear/GitHub context extraction.
- VS Code/Cursor extension.
- Terminal/shell integrations.

Difficulty: high. The challenge is per-app integration and ongoing maintenance.

## 18. Build Plan

### Week 1

- Create Electron + TypeScript + React app.
- Add hotkey registration.
- Add platform permission/status checks.
- Implement selected-text capture via copy-selection fallback on macOS and Windows.
- Implement clipboard fallback.
- Implement backend proxy client.
- Implement first prompt compiler call.
- Replace selected text in TextEdit/Notes or Notepad, Chrome, VS Code/Cursor, and at least one terminal on each platform available for testing.
- Add Speed mode using `OPENAI_MODEL_SPEED`.

### Week 2

- Add Willow-style dashboard.
- Add Speed/Quality mode selector.
- Add prompt templates for General, Coding Agent, Debugging, and Research.
- Add error handling and toast states.
- Add clipboard restoration.
- Add local logs for debugging, with prompt content excluded by default.
- Add first packaged macOS and Windows builds.
- Add latency instrumentation from hotkey press to pasted text.

### Weeks 3-4

- Add preview/diff overlay.
- Add local history toggle.
- Add custom modes.
- Add app-specific mode detection.
- Add app denylist.
- Add context receipt.

### Weeks 5-8

- Add screen capture permission flow.
- Add active window OCR.
- Add relevance filtering for visible text.
- Add tests for sensitive apps and fields.
- Add manual QA matrix across top target apps.

### Weeks 9-12

- Add browser extension.
- Add DOM context for ChatGPT, Claude, Gemini, Gmail, Slack, GitHub, and Linear.
- Add native messaging bridge.
- Add terminal and shell experiments.

## 19. Acceptance Criteria for MVP

MVP is done when:

- User can install and launch the Electron tray app on macOS.
- User can install and launch the Electron tray app on Windows.
- User can grant required OS permissions on macOS.
- User can set a hotkey.
- User can switch between Speed and Quality modes.
- Speed mode uses `OPENAI_MODEL_SPEED`, initially `gpt-5.4-nano`.
- Quality mode uses `OPENAI_MODEL_QUALITY`, initially `gpt-5.4-mini`.
- User can select text in a native text editor and replace it with an optimized prompt on macOS and Windows.
- User can select text in Chrome and replace it with an optimized prompt on macOS and Windows.
- User can select text in VS Code or Cursor and replace it with an optimized prompt on macOS and Windows.
- User can select text in a terminal and either replace it or get the optimized prompt copied as fallback.
- App handles failure without losing the user's original clipboard content.
- App has at least General, Coding Agent, and Debugging modes.
- Dashboard shows hotkey, active mode, backend status, prompts enhanced, and average latency.
- Speed mode p95 hotkey-to-paste latency is under 2 seconds for selected-text-only prompts in the primary test apps.
- App returns only the rewritten prompt in inline mode.
- App does not send clipboard or screen context unless enabled.

## 20. Test Matrix

| Surface | Expected MVP Behavior |
| --- | --- |
| macOS TextEdit | Read selected text and replace inline. |
| macOS Notes | Read selected text and replace inline. |
| Windows Notepad | Read selected text and replace inline. |
| Windows native text field | Read selected text and replace inline. |
| Chrome ChatGPT | Read selected prompt and replace inline on macOS and Windows. |
| Claude web | Read selected prompt and replace inline on macOS and Windows. |
| VS Code editor | Read selected text and replace inline on macOS and Windows. |
| Cursor editor | Read selected text and replace inline on macOS and Windows. |
| iTerm/Warp/Ghostty | Selected text rewrite or clipboard fallback on macOS. |
| Windows Terminal/PowerShell | Selected text rewrite or clipboard fallback on Windows. |
| Slack | Selected text rewrite or clipboard fallback. |
| Gmail | Selected text rewrite or clipboard fallback. |

## 21. Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Cross-platform text replacement is inconsistent across apps. | High | Use layered approach: copy-selection fallback first, OS helpers second, app adapters later. |
| Terminal input buffers are hard to access. | High | MVP requires selected text; later add shell widgets/wrappers. |
| Context-aware output invents details. | High | Strong compiler rules, context receipts, warnings, evals. |
| Privacy concerns block adoption. | High | Opt-in context sources, denylist, local history off by default. |
| Generic prompt enhancement is crowded. | Medium | Position around coding-agent prompt compilation and screen context. |
| Latency breaks habit. | High | Use `gpt-5.4-nano` by default, one request only, strict output limits, short context packets, timeout fallback, and quality mode only by explicit choice. |
| Replacement can corrupt text fields. | Medium | Clipboard restoration, preview mode, robust undo, safe fallback. |

## 22. Open Questions

- Should BYO API keys be exposed in V1, or should the first release stay managed-backend-only?
- Should preview be disabled by default for maximum speed, with a separate preview hotkey for careful prompts?
- Should "screen context" be a separate hotkey to make privacy feel safer?
- Which first terminal target matters most: iTerm, Warp, Ghostty, Terminal.app, or Claude Code itself?
- Should the first wedge be "prompt enhancer for everyone" or "agent prompt compiler for developers"? Recommendation: choose agent prompt compiler for developers.
- Should voice be added through native dictation integration, Whisper, or partnership with an existing voice tool?

## 23. Recommended First Version

Build the narrowest useful version:

> An Electron tray app for macOS and Windows that rewrites selected rough prompts into coding-agent-ready instructions in 1 to 2 seconds, replaces the selection inline, and shows a tiny Willow-style dashboard with hotkey, mode, backend status, and lightweight usage stats.

Ship it to yourself and a few AI-heavy developer friends. Watch whether they use it repeatedly in Claude Code, Codex, Cursor, and ChatGPT. If usage sticks, add screen OCR and browser/IDE context. If usage does not stick, the likely issue is not model quality. It is replacement reliability, latency, or the prompt modes not matching real workflows.

## 24. Initial Task Backlog

1. Scaffold Electron + TypeScript + React tray app.
2. Implement global hotkey.
3. Implement macOS and Windows permission/status checks.
4. Implement selected text capture through copy-selection fallback.
5. Implement clipboard fallback with restoration.
6. Implement backend proxy client.
7. Implement TypeScript backend `POST /v1/compile-prompt`.
8. Implement Speed mode with `gpt-5.4-nano`.
9. Implement Quality mode with `gpt-5.4-mini`.
10. Implement base prompt compiler.
11. Implement General, Coding Agent, and Debugging modes.
12. Implement inline replacement.
13. Add success/failure toast.
14. Add Willow-style dashboard.
15. Add latency and acceptance metrics.
16. Add app denylist.
17. Add manual QA matrix for macOS and Windows.
18. Package test builds.

## 25. Decision

This is possible and worth building as a focused tool. The MVP should now be an Electron app for macOS and Windows. The hard version is not the LLM call. The hard version is reliable, privacy-conscious cross-platform text capture/replacement while keeping the hotkey-to-paste loop under 1 to 2 seconds.

The market already has adjacent and direct competitors, which is a good sign but also means the generic version has weak defensibility. The strongest build path is a developer-first, context-aware prompt compiler for agentic coding tools.
