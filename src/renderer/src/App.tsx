import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bolt,
  Check,
  Clipboard,
  Eye,
  Gauge,
  History,
  Keyboard,
  Plus,
  Play,
  RefreshCw,
  RotateCw,
  Settings,
  Shield,
  Trash2,
  X
} from "lucide-react";
import type {
  AppSettings,
  BuiltInPromptMode,
  CompilePromptResponse,
  ContextReceipt,
  CustomPromptMode,
  DashboardState,
  OptimizationMode,
  PromptMode
} from "../../shared/types";
import "./styles.css";

const PROMPT_MODES: Array<{ value: BuiltInPromptMode; label: string }> = [
  { value: "coding_agent", label: "Agent" },
  { value: "general", label: "General" },
  { value: "debugging", label: "Debug" },
  { value: "research", label: "Research" }
];

const OPTIMIZATION_MODES: Array<{ value: OptimizationMode; label: string }> = [
  { value: "speed", label: "Speed" },
  { value: "quality", label: "Quality" }
];

const api = window.shakespeare ?? createPreviewApi();

export default function App(): JSX.Element {
  const [state, setState] = useState<DashboardState | null>(null);
  const [samplePrompt, setSamplePrompt] = useState("fix this auth bug and make sure tests pass");
  const [sampleResult, setSampleResult] = useState<CompilePromptResponse | null>(null);
  const [denylistDraft, setDenylistDraft] = useState("");
  const [customDraftId, setCustomDraftId] = useState<string | null>(null);
  const [customNameDraft, setCustomNameDraft] = useState("");
  const [customInstructionDraft, setCustomInstructionDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.getState().then((next) => {
      setState(next);
      setDenylistDraft(next.settings.appDenylist.join("\n"));
      primeCustomDraft(next.settings.customModes, next.settings.activeCustomModeId);
    });
    return api.onStateChanged((next) => {
      setState(next);
      setDenylistDraft(next.settings.appDenylist.join("\n"));
    });
  }, []);

  const metrics = useMemo(() => {
    const stats = state?.settings.stats;
    if (!stats) {
      return {
        prompts: "0",
        latency: "—",
        accepted: "0",
        saved: "0m",
        previewRate: "—"
      };
    }

    const averageLatency = stats.promptsEnhanced > 0 ? Math.round(stats.totalLatencyMs / stats.promptsEnhanced) : 0;
    const previewActions = stats.regeneratedPreviews + stats.canceledPreviews;
    return {
      prompts: String(stats.promptsEnhanced),
      latency: averageLatency > 0 ? `${averageLatency} ms` : "—",
      accepted: String(stats.acceptedRewrites),
      saved: `${Math.round(stats.estimatedTimeSavedMs / 60_000)}m`,
      previewRate: previewActions > 0 ? `${stats.regeneratedPreviews}/${stats.canceledPreviews}` : "—"
    };
  }, [state]);

  if (!state) {
    return (
      <main className="shell loading">
        <Activity className="spin" size={28} />
      </main>
    );
  }

  async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
    setError(null);
    const next = await api.updateSettings(patch);
    setState(next);
  }

  async function runSample(): Promise<void> {
    setBusy(true);
    setError(null);
    setSampleResult(null);
    try {
      const result = await api.compileSample(samplePrompt);
      setSampleResult(result);
      const next = await api.getState();
      setState(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rewrite failed.");
    } finally {
      setBusy(false);
    }
  }

  async function rewriteSelection(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await api.rewriteSelection();
      if (!result.ok) setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rewrite failed.");
    } finally {
      setBusy(false);
    }
  }

  async function previewAction(action: "accept" | "cancel" | "regenerate"): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result =
        action === "accept"
          ? await api.acceptPreview()
          : action === "cancel"
            ? await api.cancelPreview()
            : await api.regeneratePreview();
      if (!result.ok) setError(result.error);
      const next = await api.getState();
      setState(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDenylist(): Promise<void> {
    await updateSettings({
      appDenylist: denylistDraft
        .split("\n")
        .map((entry) => entry.trim())
        .filter(Boolean)
    });
  }

  function primeCustomDraft(customModes: CustomPromptMode[], activeCustomModeId: string | null): void {
    const mode = customModes.find((candidate) => candidate.id === activeCustomModeId) ?? customModes[0];
    if (!mode) return;
    setCustomDraftId(mode.id);
    setCustomNameDraft(mode.name);
    setCustomInstructionDraft(mode.instructions);
  }

  function editCustomMode(mode: CustomPromptMode): void {
    setCustomDraftId(mode.id);
    setCustomNameDraft(mode.name);
    setCustomInstructionDraft(mode.instructions);
  }

  function newCustomMode(): void {
    setCustomDraftId(null);
    setCustomNameDraft("");
    setCustomInstructionDraft("");
  }

  async function selectCustomMode(mode: CustomPromptMode): Promise<void> {
    editCustomMode(mode);
    await updateSettings({
      promptMode: "custom",
      activeCustomModeId: mode.id
    });
  }

  async function saveCustomMode(): Promise<void> {
    if (!state) return;
    const settings = state.settings;
    const name = customNameDraft.trim();
    const instructions = customInstructionDraft.trim();
    if (!name || !instructions) {
      setError("Custom modes need a name and instructions.");
      return;
    }

    const now = new Date().toISOString();
    const id = customDraftId ?? `custom-${crypto.randomUUID()}`;
    const existing = settings.customModes.find((mode) => mode.id === id);
    const nextMode: CustomPromptMode = {
      id,
      name,
      instructions,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    const nextModes = existing
      ? settings.customModes.map((mode) => (mode.id === id ? nextMode : mode))
      : [nextMode, ...settings.customModes].slice(0, 12);

    await updateSettings({
      customModes: nextModes,
      activeCustomModeId: id,
      promptMode: "custom"
    });
    setCustomDraftId(id);
  }

  async function deleteCustomMode(): Promise<void> {
    if (!state) return;
    if (!customDraftId) return;
    const settings = state.settings;

    const nextModes = settings.customModes.filter((mode) => mode.id !== customDraftId);
    await updateSettings({
      customModes: nextModes,
      activeCustomModeId: settings.activeCustomModeId === customDraftId ? null : settings.activeCustomModeId,
      promptMode: settings.promptMode === "custom" && settings.activeCustomModeId === customDraftId ? "coding_agent" : settings.promptMode
    });
    const nextMode = nextModes[0];
    if (nextMode) {
      editCustomMode(nextMode);
    } else {
      newCustomMode();
    }
  }

  async function captureScreenContext(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await api.captureScreenContext();
      if (!result.ok) setError(result.error);
      const next = await api.getState();
      setState(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Screen capture failed.");
    } finally {
      setBusy(false);
    }
  }

  async function clearScreenContext(): Promise<void> {
    await api.clearScreenContext();
    const next = await api.getState();
    setState(next);
  }

  const enabled = state.backendHealthy && state.registeredHotkey;
  const receipt = sampleResult ? receiptFromResponse(sampleResult) : state.lastReceipt;
  const browserContextLabel = state.browserContext
    ? `${state.browserContext.hostname || "browser"} · ${new Date(state.browserContext.updatedAt).toLocaleTimeString()}`
    : "No fresh page";
  const ideContextLabel = state.ideContext
    ? `${state.ideContext.editor} · ${state.ideContext.relativeFilePath || state.ideContext.filePath || "active editor"}`
    : "No editor context";
  const screenContextLabel = state.screenContext
    ? `${state.screenContext.sourceName} · ${state.screenContext.latencyMs} ms`
    : "No capture";
  const activeCustomMode = state.settings.customModes.find((mode) => mode.id === state.settings.activeCustomModeId);

  return (
    <main className="shell">
      <section className="mast">
        <div>
          <p className="eyebrow">Shakespeare</p>
          <h1>Prompt rewrite is {enabled ? "ready" : "waiting"}</h1>
        </div>
        <div className={`status ${enabled ? "ready" : "waiting"}`}>
          <span />
          {enabled ? "Enabled" : "Check setup"}
        </div>
      </section>

      <section className="hotkey-band">
        <div>
          <p className="label">Hotkey</p>
          <div className="hotkey">
            <Keyboard size={22} />
            <strong>{state.settings.hotkey}</strong>
          </div>
        </div>
        <button className="primary" onClick={rewriteSelection} disabled={busy}>
          <Clipboard size={18} />
          Rewrite selection
        </button>
      </section>

      <section className="controls-grid">
        <div className="panel">
          <div className="panel-title">
            <Bolt size={18} />
            Mode
          </div>
          <div className="segmented">
            {OPTIMIZATION_MODES.map((mode) => (
              <button
                key={mode.value}
                className={state.settings.optimizationMode === mode.value ? "selected" : ""}
                onClick={() => void updateSettings({ optimizationMode: mode.value })}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">
            <Settings size={18} />
            Prompt
          </div>
          <div className="segmented four">
            {PROMPT_MODES.map((mode) => (
              <button
                key={mode.value}
                className={state.settings.promptMode === mode.value ? "selected" : ""}
                onClick={() => void updateSettings({ promptMode: mode.value })}
              >
                {mode.label}
              </button>
            ))}
          </div>
          {state.settings.customModes.length ? (
            <div className="custom-mode-picker">
              <span>Custom</span>
              <div>
                {state.settings.customModes.slice(0, 4).map((mode) => (
                  <button
                    key={mode.id}
                    className={state.settings.promptMode === "custom" && state.settings.activeCustomModeId === mode.id ? "selected" : ""}
                    onClick={() => void selectCustomMode(mode)}
                  >
                    {mode.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {state.settings.promptMode === "custom" && activeCustomMode ? (
            <p className="mode-note">Using {activeCustomMode.name}</p>
          ) : null}
        </div>
      </section>

      <section className="metrics" aria-label="Usage">
        <Metric icon={<Check size={16} />} label="Enhanced" value={metrics.prompts} />
        <Metric icon={<Gauge size={16} />} label="Average" value={metrics.latency} />
        <Metric icon={<Activity size={16} />} label="Accepted" value={metrics.accepted} />
        <Metric icon={<RotateCw size={16} />} label="Preview R/C" value={metrics.previewRate} />
        <Metric icon={<Bolt size={16} />} label="Saved" value={metrics.saved} />
      </section>

      {state.pendingPreview ? (
        <section className="preview-panel">
          <div className="panel-title">
            <Eye size={18} />
            Preview ready
          </div>
          <div className="diff">
            <div>
              <span>Original</span>
              <pre>{state.pendingPreview.roughPrompt}</pre>
            </div>
            <div>
              <span>Optimized</span>
              <pre>{state.pendingPreview.optimizedPrompt}</pre>
            </div>
          </div>
          <Receipt receipt={state.pendingPreview.contextReceipt} />
          <div className="button-row">
            <button className="primary" onClick={() => void previewAction("accept")} disabled={busy}>
              <Check size={16} />
              Accept
            </button>
            <button className="secondary" onClick={() => void previewAction("regenerate")} disabled={busy}>
              <RefreshCw size={16} />
              Regenerate
            </button>
            <button className="ghost" onClick={() => void previewAction("cancel")} disabled={busy}>
              <X size={16} />
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      <section className="try-panel">
        <div className="panel-title">
          <Play size={18} />
          Try rewrite
        </div>
        <textarea value={samplePrompt} onChange={(event) => setSamplePrompt(event.target.value)} />
        <div className="try-actions">
          <button className="secondary" onClick={runSample} disabled={busy || !samplePrompt.trim()}>
            {busy ? <RefreshCw className="spin" size={16} /> : <Play size={16} />}
            Run
          </button>
        </div>
        {sampleResult ? (
          <output className="result">
            <span>{sampleResult.model ?? "model"}</span>
            {sampleResult.optimized_prompt}
          </output>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="settings-grid">
        <div className="panel">
          <div className="panel-title">
            <Keyboard size={18} />
            Controls
          </div>
          <TextSetting
            label="Rewrite hotkey"
            value={state.settings.hotkey}
            onSave={(hotkey) => updateSettings({ hotkey })}
          />
          <TextSetting
            label="Accept preview hotkey"
            value={state.settings.previewHotkey}
            onSave={(previewHotkey) => updateSettings({ previewHotkey })}
          />
          <TextSetting
            label="Backend URL"
            value={state.settings.backendUrl}
            onSave={(backendUrl) => updateSettings({ backendUrl })}
          />
        </div>

        <div className="panel">
          <div className="panel-title">
            <Shield size={18} />
            Privacy
          </div>
          <Toggle
            label="Preview before replace"
            checked={state.settings.previewEnabled}
            onChange={(previewEnabled) => updateSettings({ previewEnabled })}
          />
          <Toggle
            label="Clipboard context"
            checked={state.settings.clipboardContextEnabled}
            onChange={(clipboardContextEnabled) => updateSettings({ clipboardContextEnabled })}
          />
          <Toggle
            label="Screen context"
            checked={state.settings.screenContextEnabled}
            onChange={(screenContextEnabled) => updateSettings({ screenContextEnabled })}
          />
          <div className="button-row context-buttons">
            <button className="secondary" onClick={captureScreenContext} disabled={busy || state.screenContextBusy}>
              {state.screenContextBusy ? <RefreshCw className="spin" size={16} /> : <Eye size={16} />}
              Capture screen
            </button>
            <button className="ghost" onClick={clearScreenContext} disabled={!state.screenContext}>
              Clear
            </button>
          </div>
          <Toggle
            label="Browser context"
            checked={state.settings.browserContextEnabled}
            onChange={(browserContextEnabled) => updateSettings({ browserContextEnabled })}
          />
          <Toggle
            label="IDE context"
            checked={state.settings.ideContextEnabled}
            onChange={(ideContextEnabled) => updateSettings({ ideContextEnabled })}
          />
          <Toggle
            label="Local history"
            checked={state.settings.localHistoryEnabled}
            onChange={(localHistoryEnabled) => updateSettings({ localHistoryEnabled })}
          />
          <Toggle
            label="Restore clipboard"
            checked={state.settings.restoreClipboard}
            onChange={(restoreClipboard) => updateSettings({ restoreClipboard })}
          />
        </div>
      </section>

      <section className="settings-grid">
        <div className="panel">
          <div className="panel-title">
            <Plus size={18} />
            Custom modes
          </div>
          {state.settings.customModes.length ? (
            <div className="custom-mode-list">
              {state.settings.customModes.map((mode) => (
                <button
                  key={mode.id}
                  className={customDraftId === mode.id ? "selected" : ""}
                  onClick={() => editCustomMode(mode)}
                >
                  {mode.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">No custom modes yet.</p>
          )}
          <label className="text-setting">
            <span>Mode name</span>
            <input value={customNameDraft} onChange={(event) => setCustomNameDraft(event.target.value)} />
          </label>
          <label className="text-setting">
            <span>Instructions</span>
            <textarea
              className="custom-mode-textarea"
              value={customInstructionDraft}
              placeholder="Rewrite for architecture reviews. Emphasize trade-offs, risks, and specific implementation steps."
              onChange={(event) => setCustomInstructionDraft(event.target.value)}
            />
          </label>
          <div className="button-row">
            <button className="secondary" onClick={() => void saveCustomMode()}>
              <Check size={16} />
              Save mode
            </button>
            <button className="ghost" onClick={newCustomMode}>
              <Plus size={16} />
              New
            </button>
            <button className="ghost" onClick={() => void deleteCustomMode()} disabled={!customDraftId}>
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">
            <X size={18} />
            Denylist
          </div>
          <textarea
            className="compact-textarea"
            value={denylistDraft}
            placeholder="One app, domain, or window title per line"
            onChange={(event) => setDenylistDraft(event.target.value)}
          />
          <button className="secondary" onClick={saveDenylist}>
            Save denylist
          </button>
        </div>

        <div className="panel">
          <div className="panel-title">
            <History size={18} />
            Context receipt
          </div>
          <Receipt receipt={receipt} />
          <div className="browser-context-line">
            <span>Browser bridge</span>
            <strong>{state.browserBridge.running ? `:${state.browserBridge.port}` : "offline"}</strong>
            <em>{browserContextLabel}</em>
          </div>
          <div className="browser-context-line">
            <span>IDE bridge</span>
            <strong>{state.ideBridge.running ? `:${state.ideBridge.port}` : "offline"}</strong>
            <em>{ideContextLabel}</em>
          </div>
          <div className="browser-context-line">
            <span>Screen OCR</span>
            <strong>{state.screenContextBusy ? "running" : state.screenContext ? "ready" : "empty"}</strong>
            <em>{screenContextLabel}</em>
          </div>
          {state.history.length > 0 ? (
            <div className="history-list">
              {state.history.slice(0, 3).map((record) => (
                <article key={record.id}>
                  <span>{new Date(record.createdAt).toLocaleTimeString()}</span>
                  <strong>{record.optimizedPrompt}</strong>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">Local history is empty or disabled.</p>
          )}
        </div>
      </section>

      <section className="setup-row">
        <StatusPill label="Backend" value={state.backendHealthy ? "Online" : "Offline"} good={state.backendHealthy} />
        <StatusPill label="Hotkey" value={state.registeredHotkey ? "Registered" : "Missing"} good={state.registeredHotkey} />
        <StatusPill
          label="Preview key"
          value={state.registeredPreviewHotkey ? "Registered" : "Missing"}
          good={state.registeredPreviewHotkey}
        />
        <StatusPill
          label="Browser"
          value={state.browserBridge.running ? "Bridge on" : "Bridge off"}
          good={state.browserBridge.running}
        />
        <StatusPill label="IDE" value={state.ideBridge.running ? "Bridge on" : "Bridge off"} good={state.ideBridge.running} />
        <StatusPill label="Platform" value={state.platform} good />
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: JSX.Element; label: string; value: string }): JSX.Element {
  return (
    <div className="metric">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void | Promise<void>;
}): JSX.Element {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => void onChange(event.target.checked)} />
    </label>
  );
}

function TextSetting({
  label,
  value,
  onSave
}: {
  label: string;
  value: string;
  onSave: (value: string) => void | Promise<void>;
}): JSX.Element {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <label className="text-setting">
      <span>{label}</span>
      <div>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} />
        <button className="mini" onClick={() => void onSave(draft.trim())}>
          Save
        </button>
      </div>
    </label>
  );
}

function Receipt({ receipt }: { receipt: ContextReceipt | null }): JSX.Element {
  if (!receipt) {
    return <p className="muted">No context has been sent yet.</p>;
  }

  return (
    <div className="receipt">
      <span>{receipt.model ?? "model unknown"}</span>
      <span>{receipt.latency_ms != null ? `${receipt.latency_ms} ms` : "latency unknown"}</span>
      <span>{receipt.context_used.length ? receipt.context_used.join(", ") : "selected text only"}</span>
      {receipt.warnings.length ? <em>{receipt.warnings.join(" ")}</em> : null}
    </div>
  );
}

function StatusPill({ label, value, good }: { label: string; value: string; good: boolean }): JSX.Element {
  return (
    <div className={`pill ${good ? "good" : "bad"}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function receiptFromResponse(response: CompilePromptResponse): ContextReceipt {
  return {
    context_used: response.context_used,
    warnings: response.warnings,
    model: response.model,
    latency_ms: response.latency_ms
  };
}

function createPreviewApi(): Window["shakespeare"] {
  let state: DashboardState = {
    backendHealthy: true,
    registeredHotkey: true,
    registeredPreviewHotkey: true,
    browserBridge: {
      port: 8791,
      running: true
    },
    ideBridge: {
      port: 8792,
      running: true
    },
    browserContext: {
      url: "https://chatgpt.com/c/example",
      title: "ChatGPT",
      hostname: "chatgpt.com",
      selectedText: "fix this auth bug",
      focusedText: "fix this auth bug",
      visibleText: "ChatGPT conversation about an auth bug",
      updatedAt: new Date().toISOString(),
      source: "browser_extension"
    },
    ideContext: {
      editor: "Cursor",
      workspaceName: "shakespeare",
      workspaceFolders: ["/Users/shreshth/Documents/Shakespeare"],
      filePath: "/Users/shreshth/Documents/Shakespeare/src/main/index.ts",
      relativeFilePath: "src/main/index.ts",
      languageId: "typescript",
      selectedText: "buildContext(...)",
      visibleText: "function buildContext(...)",
      diagnostics: "No diagnostics.",
      gitDiff: "diff --git a/src/main/index.ts b/src/main/index.ts",
      updatedAt: new Date().toISOString(),
      source: "ide_extension"
    },
    screenContext: {
      text: "Error: Auth callback failed in src/auth/session.ts",
      sourceName: "Entire Screen",
      capturedAt: new Date().toISOString(),
      latencyMs: 1320
    },
    screenContextBusy: false,
    pendingPreview: null,
    history: [],
    lastReceipt: {
      context_used: ["selected_text", "active_app", "detected_target"],
      warnings: [],
      model: "gpt-5.4-nano",
      latency_ms: 980
    },
    platform: "darwin",
    permissions: {
      accessibility: "granted",
      screen: "disabled"
    },
    settings: {
      hotkey: "CommandOrControl+Shift+P",
      previewHotkey: "CommandOrControl+Shift+Enter",
      backendUrl: "http://127.0.0.1:8787",
      clientToken: "",
      promptMode: "coding_agent",
      activeCustomModeId: "custom-review",
      customModes: [
        {
          id: "custom-review",
          name: "Review",
          instructions: "Rewrite the request as a concise code review prompt. Prioritize bugs, regressions, missing tests, and exact file references.",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      optimizationMode: "speed",
      restoreClipboard: true,
      previewEnabled: false,
      clipboardContextEnabled: false,
      screenContextEnabled: false,
      browserContextEnabled: false,
      ideContextEnabled: false,
      localHistoryEnabled: false,
      appDenylist: ["1Password"],
      stats: {
        promptsEnhanced: 18,
        acceptedRewrites: 17,
        failedRewrites: 1,
        totalLatencyMs: 17_640,
        estimatedTimeSavedMs: 12 * 60_000,
        regeneratedPreviews: 2,
        canceledPreviews: 1
      }
    }
  };

  return {
    getState: async () => state,
    updateSettings: async (patch) => {
      state = {
        ...state,
        settings: {
          ...state.settings,
          ...patch,
          stats: {
            ...state.settings.stats,
            ...(patch.stats ?? {})
          }
        }
      };
      return state;
    },
    checkBackend: async () => true,
    compileSample: async (roughPrompt) => ({
      optimized_prompt: `Goal: ${roughPrompt}\nStart by inspecting the relevant files and current behavior before editing. Keep the change scoped, verify the result, and summarize what changed.`,
      context_used: ["selected_text"],
      warnings: [],
      model: state.settings.optimizationMode === "speed" ? "gpt-5.4-nano" : "gpt-5.4-mini",
      latency_ms: 980
    }),
    rewriteSelection: async () => ({ ok: true }),
    acceptPreview: async () => ({ ok: true }),
    cancelPreview: async () => ({ ok: true }),
    regeneratePreview: async () => ({ ok: true }),
    captureScreenContext: async () => ({
      ok: true,
      snapshot: {
        text: "Error: Auth callback failed in src/auth/session.ts",
        sourceName: "Entire Screen",
        capturedAt: new Date().toISOString(),
        latencyMs: 1320
      }
    }),
    clearScreenContext: async () => ({ ok: true }),
    openExternal: async (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onStateChanged: () => () => undefined
  };
}
