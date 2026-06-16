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
```
