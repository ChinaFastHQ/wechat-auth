import { WeChatAuth } from "./core.js";
import type { WeChatAuthListener } from "./types.js";
const cleanups = new Set<() => void>();

export function addAuthListener(listener: WeChatAuthListener): () => void {
  const cleanup = WeChatAuth.addAuthListener(listener);
  cleanups.add(cleanup);
  return () => {
    cleanups.delete(cleanup);
    cleanup();
  };
}

export function clearListenersForTests(): void {
  cleanups.forEach((cleanup) => cleanup());
  cleanups.clear();
  WeChatAuth.clearAuthListeners();
}
