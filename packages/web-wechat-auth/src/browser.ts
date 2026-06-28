import {
  browserFromUserAgent,
  createSerializedPendingAuthStorage,
  createWeChatAuth as createCoreClient,
  deviceFromUserAgent,
  encodeBase64Url,
  type PendingAuthStorage,
  type WeChatAuthClient,
  type WeChatAuthConfig,
  type WeChatAuthEnvironment,
} from "@chinafast/wechat-auth-core";

const DEFAULT_KEY = "web-wechat-auth.pending";
export type BrowserStorageKind = "session" | "local";
export type BrowserWeChatAuthOptions = {
  storage?: PendingAuthStorage | BrowserStorageKind;
  storageKey?: string;
  navigate?: (url: string) => void | Promise<void>;
  userAgent?: () => string;
  clock?: () => number;
  generateState?: () => string;
  fetch?: typeof globalThis.fetch;
};

export function createBrowserPendingAuthStorage(
  kind: BrowserStorageKind = "session",
  key = DEFAULT_KEY
): PendingAuthStorage {
  const target = (): Storage | undefined => {
    try {
      if (typeof window === "undefined") {
        return undefined;
      }
      return kind === "local" ? window.localStorage : window.sessionStorage;
    } catch {
      return undefined;
    }
  };
  return createSerializedPendingAuthStorage(key, target);
}

function detect(
  config: WeChatAuthConfig,
  ua: string,
  browserPresent: boolean
): WeChatAuthEnvironment {
  const browser = browserFromUserAgent(ua);
  const device = deviceFromUserAgent(ua, browserPresent);
  return {
    platform: browserPresent ? "web" : "unknown",
    device,
    browser,
    runtime: browserPresent ? "web" : "unknown",
    supports: {
      nativeWeChatSdk: false,
      deepLink: false,
      universalLink: false,
      qrLogin: browserPresent && device === "desktop" && Boolean(config.web?.appId),
      officialAccountOAuth: browser === "wechat" && Boolean(config.officialAccount?.appId),
      webRedirect:
        browserPresent && Boolean(config.web?.redirectUri || config.officialAccount?.redirectUri),
    },
  };
}

function secureState(): string {
  const crypto = globalThis.crypto;
  if (!crypto?.getRandomValues) {
    throw new Error(
      "Secure random state generation is unavailable. Provide generateState in the browser client options."
    );
  }
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return encodeBase64Url(bytes, btoa);
}

/** Creates an SSR-safe browser client. Browser globals are only read when a method runs. */
export function createWeChatAuth(
  config: WeChatAuthConfig,
  options: BrowserWeChatAuthOptions = {}
): WeChatAuthClient {
  const storage =
    typeof options.storage === "object"
      ? options.storage
      : createBrowserPendingAuthStorage(
          options.storage,
          options.storageKey || config.stateStorageKey || DEFAULT_KEY
        );
  return createCoreClient(
    {
      storage,
      detectEnvironment(current) {
        const present = typeof window !== "undefined";
        const ua =
          options.userAgent?.() ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
        return detect(current, ua, present);
      },
      async openUrl(url) {
        if (options.navigate) {
          await options.navigate(url);
          return;
        }
        if (typeof window === "undefined") {
          throw new Error(
            "Browser navigation is unavailable during SSR. Provide a navigate option."
          );
        }
        window.location.assign(url);
      },
      generateState: options.generateState || secureState,
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
      now: options.clock,
      fetch: options.fetch || globalThis.fetch?.bind(globalThis),
    },
    config
  );
}
