import type { WeChatAuthConfig } from "./types.js";

let currentConfig: WeChatAuthConfig | undefined;

export function configure(config: WeChatAuthConfig): void {
  currentConfig = { ...config };
}

export function getConfig(): WeChatAuthConfig | undefined {
  return currentConfig;
}

export function requireConfig(): WeChatAuthConfig {
  if (!currentConfig) {
    throw new Error("WeChatAuth is not configured. Call WeChatAuth.configure(config) first.");
  }
  return currentConfig;
}

export function resetConfigForTests(): void {
  currentConfig = undefined;
}
