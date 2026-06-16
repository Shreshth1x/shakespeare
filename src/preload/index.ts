import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, CompilePromptResponse, DashboardState } from "../shared/types";

const api = {
  getState: (): Promise<DashboardState> => ipcRenderer.invoke("state:get"),
  updateSettings: (patch: Partial<AppSettings>): Promise<DashboardState> => ipcRenderer.invoke("settings:update", patch),
  checkBackend: (): Promise<boolean> => ipcRenderer.invoke("backend:check"),
  compileSample: (roughPrompt: string): Promise<CompilePromptResponse> => ipcRenderer.invoke("compile:sample", roughPrompt),
  rewriteSelection: (): Promise<{ ok: true } | { ok: false; error: string }> => ipcRenderer.invoke("rewrite:selection"),
  acceptPreview: (): Promise<{ ok: true } | { ok: false; error: string }> => ipcRenderer.invoke("preview:accept"),
  cancelPreview: (): Promise<{ ok: true }> => ipcRenderer.invoke("preview:cancel"),
  regeneratePreview: (): Promise<{ ok: true } | { ok: false; error: string }> => ipcRenderer.invoke("preview:regenerate"),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke("shell:openExternal", url),
  onStateChanged: (callback: (state: DashboardState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: DashboardState): void => callback(state);
    ipcRenderer.on("state:changed", listener);
    return () => ipcRenderer.removeListener("state:changed", listener);
  }
};

contextBridge.exposeInMainWorld("shakespeare", api);

export type ShakespeareApi = typeof api;
