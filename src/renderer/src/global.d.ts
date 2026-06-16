import type { ShakespeareApi } from "../../preload";

declare global {
  interface Window {
    shakespeare: ShakespeareApi;
  }
}

export {};
