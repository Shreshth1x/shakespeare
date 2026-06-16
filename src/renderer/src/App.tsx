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
  Play,
  RefreshCw,
  RotateCw,
  Settings,
  Shield,
  X
} from "lucide-react";
import type {
  AppSettings,
  CompilePromptResponse,
  ContextReceipt,
  DashboardState,
  OptimizationMode,
  PromptMode
} from "../../shared/types";
import "./styles.css";

const PROMPT_MODES: Array<{ value: PromptMode; label: string }> = [
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.getState().then((next) => {
      setState(next);
      setDenylistDraft(next.settings.appDenylist.join("\n"));
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

  const enabled = state.backendHealthy && state.registeredHotkey;
  const receipt = sampleResult ? receiptFromResponse(sampleResult) : state.lastReceipt;
  const browserContextLabel = state.browserContext
    ? `${state.browserContext.hostname || "browser"} · ${new Date(state.browserContext.updatedAt).toLocaleTimeString()}`
    : "No fresh page";

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
          <Toggle
            label="Browser context"
            checked={state.settings.browserContextEnabled}
            onChange={(browserContextEnabled) => updateSettings({ browserContextEnabled })}
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
      optimizationMode: "speed",
      restoreClipboard: true,
      previewEnabled: false,
      clipboardContextEnabled: false,
      screenContextEnabled: false,
      browserContextEnabled: false,
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
    openExternal: async (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onStateChanged: () => () => undefined
  };
}
