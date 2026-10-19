// Minimal typing for the self-hosted Ruffle web build (window.RufflePlayer, loaded by index.html).
export interface RufflePlayerElement extends HTMLElement {
  load(options: Record<string, unknown>): Promise<void>;
  remove(): void;
}

interface RuffleSource { createPlayer(): RufflePlayerElement }
declare global {
  interface Window {
    RufflePlayer?: { newest?: () => RuffleSource | null; config?: Record<string, unknown> };
    __mbSwfEnd?: (token: string) => void;
  }
}

/** Resolves once ruffle.js has registered itself; rejects if it never does (blocked, offline, failed). */
export function ruffleReady(timeoutMs = 8000): Promise<RuffleSource> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const src = window.RufflePlayer?.newest?.();
      if (src) return resolve(src);
      if (Date.now() - started > timeoutMs) return reject(new Error("The Flash player (Ruffle) didn't load. Check your connection and reload the page."));
      setTimeout(tick, 50);
    };
    tick();
  });
}

// client.swf opens its `_end` URL when playback finishes (the original site used javascript:showEnd()).
// Each player registers a token; the payload's _end calls back into the page with it.
const endHandlers = new Map<string, () => void>();
window.__mbSwfEnd = (token: string) => endHandlers.get(token)?.();
let tokenSeq = 0;
export function registerEnd(handler: () => void): { token: string; url: string; dispose(): void } {
  const token = "e" + ++tokenSeq;
  endHandlers.set(token, handler);
  return { token, url: `javascript:window.__mbSwfEnd&&window.__mbSwfEnd("${token}")`, dispose: () => endHandlers.delete(token) };
}

export const SWF_BASE = "/swf/";
export const swfUrl = (file: string) => new URL(SWF_BASE + file, window.location.href).href;
