import { useEffect, useMemo, useState } from "react";
import { Activity, Bolt, Check, Clipboard, ExternalLink, Gauge, Keyboard, Play, RefreshCw, Settings } from "lucide-react";
import type { AppSettings, CompilePromptResponse, DashboardState, OptimizationMode, PromptMode } from "../../shared/types";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.getState().then(setState);
    return api.onStateChanged(setState);
  }, []);

  const metrics = useMemo(() => {
    const stats = state?.settings.stats;
    if (!stats) {
      return {
        prompts: "0",
        latency: "—",
        accepted: "0",
        saved: "0m"
      };
    }

    const averageLatency = stats.promptsEnhanced > 0 ? Math.round(stats.totalLatencyMs / stats.promptsEnhanced) : 0;
    return {
      prompts: String(stats.promptsEnhanced),
      latency: averageLatency > 0 ? `${averageLatency} ms` : "—",
      accepted: String(stats.acceptedRewrites),
      saved: `${Math.round(stats.estimatedTimeSavedMs / 60_000)}m`
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

  const enabled = state.backendHealthy && state.registeredHotkey;

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
        <Metric icon={<Bolt size={16} />} label="Saved" value={metrics.saved} />
      </section>

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
          <button
            className="link-button"
            onClick={() => void api.openExternal("https://github.com/Shreshth1x/shakespeare")}
          >
            <ExternalLink size={15} />
            Repo
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

      <section className="setup-row">
        <StatusPill label="Backend" value={state.backendHealthy ? "Online" : "Offline"} good={state.backendHealthy} />
        <StatusPill label="Hotkey" value={state.registeredHotkey ? "Registered" : "Missing"} good={state.registeredHotkey} />
        <StatusPill label="Platform" value={state.platform} good />
      </section>
    </main>
  );
}

function createPreviewApi(): Window["shakespeare"] {
  let state: DashboardState = {
    backendHealthy: true,
    registeredHotkey: true,
    platform: "darwin",
    permissions: {
      accessibility: "granted",
      screen: "disabled"
    },
    settings: {
      hotkey: "⌘⇧P",
      backendUrl: "http://127.0.0.1:8787",
      clientToken: "",
      promptMode: "coding_agent",
      optimizationMode: "speed",
      restoreClipboard: true,
      stats: {
        promptsEnhanced: 18,
        acceptedRewrites: 17,
        failedRewrites: 1,
        totalLatencyMs: 17_640,
        estimatedTimeSavedMs: 12 * 60_000
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
    openExternal: async (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onStateChanged: () => () => undefined
  };
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

function StatusPill({ label, value, good }: { label: string; value: string; good: boolean }): JSX.Element {
  return (
    <div className={`pill ${good ? "good" : "bad"}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
