import {
  createWeChatAuth as createCoreClient,
  type WeChatAuthClient,
  type WeChatAuthRuntime,
} from "@chinafast/wechat-auth-core";
import { configure as configureConfig, getConfig } from "./config.js";
import { detectEnvironment } from "./environment.js";
import { getNativeWeChatAuthProvider } from "./native/index.js";
import type { NativeWeChatAuthProvider } from "./native/NativeWeChatAuthProvider.js";
import { generateState } from "./state.js";
import { createExpoPendingAuthStorage } from "./storage.js";
import type {
  WeChatAuthorizeInput,
  WeChatAuthConfig,
  WeChatAuthListener,
  WeChatSignInInput,
} from "./types.js";

declare const module: { require?: (specifier: string) => unknown } | undefined;

type LinkingSubscription = { remove(): void };
type ExpoLinkingModule = {
  addEventListener(type: "url", listener: (event: { url: string }) => void): LinkingSubscription;
  getInitialURL(): Promise<string | null>;
  openURL?(url: string): Promise<unknown>;
};
export type CreateWeChatAuthOptions = { nativeProvider?: NativeWeChatAuthProvider };
export type { WeChatAuthClient } from "@chinafast/wechat-auth-core";

let linkingOverride: ExpoLinkingModule | undefined;
let linkingCleanup: (() => void) | undefined;
let singleton: WeChatAuthClient | undefined;

function loadLinking(): ExpoLinkingModule | null {
  if (linkingOverride) {
    return linkingOverride;
  }
  try {
    const requireFn =
      typeof module !== "undefined" && typeof module.require === "function"
        ? module.require.bind(module)
        : undefined;
    return requireFn ? (requireFn("expo-linking") as ExpoLinkingModule) : null;
  } catch {
    return null;
  }
}

function runtime(
  config: WeChatAuthConfig,
  options: CreateWeChatAuthOptions = {}
): WeChatAuthRuntime {
  return {
    storage: createExpoPendingAuthStorage(config.stateStorageKey),
    detectEnvironment,
    async openUrl(url) {
      const linking = loadLinking();
      if (linking?.openURL) {
        await linking.openURL(url);
        return;
      }
      if (typeof window !== "undefined") {
        window.location.assign(url);
      }
    },
    generateState,
    parseCallbackUrl(url) {
      const parsed = new URL(
        url,
        typeof window !== "undefined" ? window.location.origin : "https://localhost"
      );
      return {
        code: parsed.searchParams.get("code"),
        state: parsed.searchParams.get("state") || "",
        error: parsed.searchParams.get("error") || parsed.searchParams.get("errcode"),
        redirectUri: parsed.origin + parsed.pathname,
      };
    },
    fetch: (...args) => globalThis.fetch(...args),
    nativeProvider: options.nativeProvider || getNativeWeChatAuthProvider(),
  };
}

export function createWeChatAuth(
  config: WeChatAuthConfig,
  options: CreateWeChatAuthOptions = {}
): WeChatAuthClient {
  return createCoreClient(runtime(config, options), config);
}

function active(): WeChatAuthClient | undefined {
  return singleton;
}

export function configure(config: WeChatAuthConfig): void {
  configureConfig(config);
  singleton = createWeChatAuth(config);
}

export function setExpoLinkingModuleForTests(linkingModule: ExpoLinkingModule | undefined): void {
  linkingOverride = linkingModule;
  linkingCleanup?.();
  linkingCleanup = undefined;
  if (linkingModule === undefined) {
    singleton = undefined;
  }
}

export function isAvailable(): boolean {
  return active()?.isAvailable() ?? false;
}

export async function authorize(input: WeChatAuthorizeInput = {}) {
  return (
    active()?.authorize(input) ?? {
      status: "failed" as const,
      error: { code: "NOT_CONFIGURED" as const, message: "Call configure() before authorize()." },
    }
  );
}

export async function signIn<TSession = unknown>(input: WeChatSignInInput = {}) {
  return (
    active()?.signIn<TSession>(input) ?? {
      status: "error" as const,
      error: { code: "NOT_CONFIGURED", message: "Call configure() before signIn()." },
    }
  );
}

export async function signInWithRedirect(input: WeChatAuthorizeInput = {}) {
  return (
    active()?.signInWithRedirect(input) ?? {
      status: "failed" as const,
      error: {
        code: "NOT_CONFIGURED" as const,
        message: "Call configure() before signInWithRedirect().",
      },
    }
  );
}

export async function handleRedirectCallback(url: string) {
  return (
    active()?.handleRedirectCallback(url) ?? {
      status: "failed" as const,
      error: {
        code: "NOT_CONFIGURED" as const,
        message: "Call configure() before handleRedirectCallback().",
      },
    }
  );
}

function isCallback(url: string): boolean {
  try {
    const parsed = new URL(url, "https://localhost");
    return ["code", "error", "errcode"].some((key) => parsed.searchParams.has(key));
  } catch {
    return false;
  }
}

export function installLinkingHandler(): () => void {
  if (linkingCleanup) {
    return linkingCleanup;
  }
  const linking = loadLinking();
  if (!linking) {
    if (typeof window !== "undefined" && isCallback(window.location.href)) {
      void handleRedirectCallback(window.location.href);
    }
    linkingCleanup = () => {
      linkingCleanup = undefined;
    };
    return linkingCleanup;
  }
  const subscription = linking.addEventListener("url", ({ url }) => {
    void handleRedirectCallback(url);
  });
  void linking.getInitialURL().then((url) => {
    if (url && isCallback(url)) {
      void handleRedirectCallback(url);
    }
  });
  let cleaned = false;
  linkingCleanup = () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    subscription.remove();
    linkingCleanup = undefined;
  };
  return linkingCleanup;
}

export const WeChatAuth = {
  configure,
  installLinkingHandler,
  authorize,
  signIn,
  signInWithRedirect,
  handleRedirectCallback,
  createAuthUrl: (input?: WeChatAuthorizeInput) => active()?.createAuthUrl(input) ?? null,
  detectEnvironment: () => active()?.detectEnvironment() ?? detectEnvironment(getConfig() || {}),
  resolveFlow: (input?: WeChatAuthorizeInput) => {
    const client = active();
    if (!client) {
      throw new Error("Call configure() before resolving a WeChat auth flow.");
    }
    return client.resolveFlow(input);
  },
  isAvailable,
  generateState,
  clearPendingAuth: () => active()?.clearPendingAuth(),
  getPendingAuth: () => active()?.getPendingAuth() ?? null,
  addAuthListener: (listener: WeChatAuthListener) =>
    active()?.addAuthListener(listener) ?? (() => {}),
  clearAuthListeners: () => active()?.clearAuthListeners(),
};
