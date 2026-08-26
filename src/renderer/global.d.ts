import type { GrokDesktopApi } from "../preload/index";

declare global {
  interface Window {
    grokApp: GrokDesktopApi;
  }
}

export {};
