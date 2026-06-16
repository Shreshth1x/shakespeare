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
- Optional preview-before-replace flow with accept, regenerate, and cancel.
- Privacy controls for clipboard context, screen context, local history, and clipboard restoration.
- App/window denylist to prevent context capture in sensitive surfaces.
- Context receipt showing model, latency, context sources, and warnings.
- Local-only prompt history when explicitly enabled.

## Required Backend Secrets

```bash
OPENAI_API_KEY=
OPENAI_MODEL_SPEED=gpt-5.4-nano
OPENAI_MODEL_QUALITY=gpt-5.4-mini
SHAKESPEARE_CLIENT_TOKEN=
PORT=8787
```

`SHAKESPEARE_CLIENT_TOKEN` is only required when the backend is not localhost-only.

## Verification

```bash
npm run typecheck
npm test
npm run build
```
