import { createError, failed, WeChatAuthException } from "./errors.js";
import { resolveFlow } from "./flow.js";
import type { PendingAuthStorage } from "./storage.js";
import type {
  WeChatAuthorizeInput,
  WeChatAuthorizeResult,
  WeChatAuthCodeResult,
  WeChatAuthConfig,
  WeChatAuthEnvironment,
  WeChatAuthListener,
  WeChatPendingAuth,
  WeChatSignInInput,
  WeChatSignInResult,
  ResolvedWeChatAuthFlow,
} from "./types.js";
import { createAuthorizationUrl } from "./url.js";

const DEFAULT_STATE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_EXCHANGE_URL = "/api/auth/sign-in/wechat";

export type NativeAuthorizeInput = {
  scope: "base" | "profile";
  state: string;
  appId: string;
  universalLink?: string;
  redirectUri: string;
  environment: WeChatAuthEnvironment;
};
export interface NativeWeChatAuthProvider {
  isInstalled(): Promise<boolean>;
  isAvailable(): Promise<boolean>;
  authorize(input: NativeAuthorizeInput): Promise<WeChatAuthCodeResult>;
  handleOpenUrl(url: string): Promise<WeChatAuthCodeResult | null>;
}
export interface WeChatAuthRuntime {
  storage: PendingAuthStorage;
  detectEnvironment(config: WeChatAuthConfig): WeChatAuthEnvironment;
  openUrl(url: string): Promise<void>;
  generateState(): string;
  parseCallbackUrl(url: string): {
    code: string | null;
    state: string;
    error: string | null;
    redirectUri: string;
  };
  now?(): number;
  fetch?: typeof globalThis.fetch;
  nativeProvider?: NativeWeChatAuthProvider;
}
export type WeChatAuthClient = {
  configure(config: WeChatAuthConfig): void;
  authorize(input?: WeChatAuthorizeInput): Promise<WeChatAuthorizeResult>;
  signIn<TSession = unknown>(input?: WeChatSignInInput): Promise<WeChatSignInResult<TSession>>;
  signInWithRedirect(input?: WeChatAuthorizeInput): Promise<WeChatAuthorizeResult>;
  handleRedirectCallback(url: string): Promise<WeChatAuthorizeResult>;
  createAuthUrl(input?: WeChatAuthorizeInput): string | null;
  detectEnvironment(): WeChatAuthEnvironment;
  resolveFlow(input?: WeChatAuthorizeInput): ResolvedWeChatAuthFlow;
  isAvailable(): boolean;
  generateState(): string;
  clearPendingAuth(): void;
  getPendingAuth(): WeChatPendingAuth | null;
  addAuthListener(listener: WeChatAuthListener): () => void;
  /** Clears listeners owned by this client. Intended for disposal and test isolation. */
  clearAuthListeners(): void;
};

function signInError<T>(code: string, message: string): WeChatSignInResult<T> {
  return { status: "error", error: { code, message } };
}

function exchangeUrl(config: WeChatAuthConfig, input: WeChatSignInInput): string {
  return input.exchangeUrl || config.exchangeUrl || DEFAULT_EXCHANGE_URL;
}

function stateUrl(config: WeChatAuthConfig, input: WeChatSignInInput): string {
  if (input.stateUrl || config.stateUrl) {
    return input.stateUrl || config.stateUrl || "";
  }
  const url = exchangeUrl(config, input);
  return url.endsWith("/sign-in") ? `${url.slice(0, -8)}/state` : `${url.replace(/\/$/, "")}/state`;
}

export function createWeChatAuth(
  runtime: WeChatAuthRuntime,
  initialConfig: WeChatAuthConfig
): WeChatAuthClient {
  let config = { ...initialConfig };
  const listeners = new Set<WeChatAuthListener>();
  const now = () => runtime.now?.() ?? Date.now();
  const notify = (result: WeChatAuthorizeResult) =>
    listeners.forEach((listener) => listener(result));
  const environment = () => runtime.detectEnvironment(config);
  const resolved = (input: WeChatAuthorizeInput = {}) => resolveFlow(input, config, environment());
  const authUrl = (input: WeChatAuthorizeInput = {}) =>
    createAuthorizationUrl(resolved(input), config, input);

  function readPending(): WeChatPendingAuth | null {
    try {
      return runtime.storage.get();
    } catch {
      runtime.storage.clear();
      return null;
    }
  }

  async function exchange<T>(
    input: WeChatSignInInput,
    auth: WeChatAuthCodeResult
  ): Promise<WeChatSignInResult<T>> {
    const payload = {
      code: auth.code,
      state: auth.state,
      flow: auth.flow,
      redirectUri: auth.redirectUri,
    };
    if (input.exchange) {
      return { status: "success", auth, session: (await input.exchange(payload)) as T };
    }
    const fetcher = runtime.fetch;
    if (!fetcher) {
      return signInError(
        "NETWORK_ERROR",
        "A fetch implementation is required for session exchange."
      );
    }
    const response = await fetcher(exchangeUrl(config, input), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return signInError(
        "EXCHANGE_FAILED",
        `WeChat session exchange failed with ${response.status}.`
      );
    }
    return { status: "success", auth, session: (await response.json()) as T };
  }

  async function completePersisted(
    pending: WeChatPendingAuth | null,
    auth: WeChatAuthCodeResult
  ): Promise<WeChatAuthorizeResult> {
    if (!pending?.exchangeUrl) {
      return auth;
    }
    try {
      const result = await exchange({ exchangeUrl: pending.exchangeUrl }, auth);
      return result.status === "success"
        ? { ...auth, session: result.session }
        : failed(
            createError(
              "EXCHANGE_FAILED",
              result.status === "error"
                ? result.error.message
                : "The persisted session exchange was cancelled.",
              auth
            )
          );
    } catch (cause) {
      return failed(
        createError(
          "EXCHANGE_FAILED",
          cause instanceof Error ? cause.message : "The persisted session exchange failed.",
          { ...auth, cause }
        )
      );
    }
  }

  async function rawAuthorize(
    input: WeChatAuthorizeInput = {},
    persistedExchangeUrl?: string
  ): Promise<WeChatAuthorizeResult> {
    try {
      const state = input.state || runtime.generateState();
      const flow = resolved({ ...input, state });
      const pending: WeChatPendingAuth = {
        provider: flow.provider,
        flow: flow.flow,
        scope: flow.scope,
        state,
        redirectUri: flow.redirectUri,
        authUrl: flow.flow === "native_app" ? undefined : authUrl({ ...input, state }) || undefined,
        createdAt: now(),
        returnTo: input.returnTo,
        metadata: input.metadata,
        exchangeUrl: persistedExchangeUrl,
      };
      runtime.storage.set(pending);
      if (flow.flow !== "native_app") {
        return {
          status: "pending",
          provider: pending.provider,
          flow: pending.flow,
          scope: pending.scope,
          state,
          redirectUri: pending.redirectUri,
          authUrl: pending.authUrl,
        };
      }
      const native = runtime.nativeProvider;
      if (!native || !(await native.isAvailable())) {
        runtime.storage.clear();
        return failed(
          createError(
            "NATIVE_SDK_MISSING",
            "Native WeChat SDK is unavailable. Expo Go cannot support native WeChat login.",
            pending
          )
        );
      }
      const result = await native.authorize({
        scope: pending.scope,
        state,
        appId: config.native?.appId || "",
        universalLink: config.native?.universalLink,
        redirectUri: pending.redirectUri,
        environment: flow.environment,
      });
      runtime.storage.clear();
      if (!result.state || result.state !== state) {
        return failed(
          createError(
            "INVALID_STATE",
            "WeChat native authorization returned an invalid state.",
            pending
          )
        );
      }
      notify(result);
      return result;
    } catch (cause) {
      return failed(
        cause instanceof WeChatAuthException
          ? cause.authError
          : createError(
              "UNKNOWN",
              cause instanceof Error ? cause.message : "Unknown WeChat auth error.",
              { cause }
            )
      );
    }
  }

  async function resolveState(input: WeChatSignInInput): Promise<string> {
    if (input.state) {
      return input.state;
    }
    if (!runtime.fetch) {
      throw new Error("A fetch implementation is required to request server state.");
    }
    const response = await runtime.fetch(stateUrl(config, input), { credentials: "include" });
    if (!response.ok) {
      throw new Error(`WeChat state request failed with ${response.status}.`);
    }
    const payload = (await response.json()) as { state?: unknown };
    if (typeof payload.state !== "string" || !payload.state) {
      throw new Error("WeChat state endpoint did not return a state string.");
    }
    return payload.state;
  }

  function waitFor(state: string): Promise<WeChatAuthorizeResult> {
    return new Promise((finish) => {
      let done = false;
      const settle = (result: WeChatAuthorizeResult) => {
        if (done) {
          return;
        }
        done = true;
        clearTimeout(timer);
        unsubscribe();
        finish(result);
      };
      const unsubscribe = addListener((result) => {
        if (result.status === "success" && result.state !== state) {
          return;
        }
        if (result.status === "cancelled" && result.state && result.state !== state) {
          return;
        }
        settle(result);
      });
      const timer = setTimeout(
        () =>
          settle(
            failed(createError("STATE_EXPIRED", "WeChat sign-in timed out. Start sign-in again."))
          ),
        config.stateTtlMs ?? DEFAULT_STATE_TTL_MS
      );
    });
  }

  function addListener(listener: WeChatAuthListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    configure(next) {
      config = { ...next };
    },
    authorize: rawAuthorize,
    async signIn<T>(input: WeChatSignInInput = {}): Promise<WeChatSignInResult<T>> {
      try {
        const state = await resolveState(input);
        const { exchange: _a, exchangeUrl: _b, stateUrl: _c, ...authorizeInput } = input;
        authorizeInput.state = state;
        const result = await rawAuthorize(
          authorizeInput,
          input.exchange ? input.exchangeUrl : exchangeUrl(config, input)
        );
        if (result.status === "success") {
          return exchange<T>(input, result);
        }
        if (result.status === "cancelled") {
          return { status: "cancelled" };
        }
        if (result.status === "failed") {
          return signInError(result.error.code, result.error.message);
        }
        if (!result.authUrl) {
          return signInError("REDIRECT_FAILED", "WeChat did not return an authorization URL.");
        }
        const callback = waitFor(state);
        await runtime.openUrl(result.authUrl);
        const completed = await callback;
        if (completed.status === "success") {
          return "session" in completed
            ? { status: "success", auth: completed, session: completed.session as T }
            : exchange<T>(input, completed);
        }
        if (completed.status === "cancelled") {
          return { status: "cancelled" };
        }
        return completed.status === "failed"
          ? signInError(completed.error.code, completed.error.message)
          : signInError("AUTH_PENDING", "WeChat authorization is still pending.");
      } catch (cause) {
        return signInError(
          "UNKNOWN",
          cause instanceof Error ? cause.message : "Unknown WeChat sign-in error."
        );
      }
    },
    async signInWithRedirect(input = {}) {
      const result = await rawAuthorize(input);
      if (result.status === "pending" && result.authUrl) {
        await runtime.openUrl(result.authUrl);
      }
      return result;
    },
    async handleRedirectCallback(url: string): Promise<WeChatAuthorizeResult> {
      try {
        const nativeResult = (await runtime.nativeProvider?.handleOpenUrl(url)) || null;
        const pending = readPending();
        // Consume before validation so every callback attempt is one-time, including failures.
        if (pending) {
          runtime.storage.clear();
        }
        const requireState = config.requireStoredState !== false;
        if (requireState && !pending) {
          return failed(
            createError(
              "MISSING_STATE",
              "No pending WeChat auth state was found for this callback."
            )
          );
        }
        const parsed = nativeResult ? null : runtime.parseCallbackUrl(url);
        const state = nativeResult?.state ?? parsed?.state ?? "";
        const error = parsed?.error;
        if (error) {
          return failed(
            createError("AUTH_FAILED", `WeChat returned an auth error: ${error}.`, pending || {})
          );
        }
        const code = nativeResult?.code ?? parsed?.code;
        if (!code) {
          return failed(
            createError(
              "MISSING_CODE",
              "WeChat callback URL did not include a code.",
              pending || {}
            )
          );
        }
        if (pending && pending.state !== state) {
          return failed(
            createError(
              "INVALID_STATE",
              "WeChat callback state did not match pending auth state.",
              pending
            )
          );
        }
        if (pending && now() - pending.createdAt > (config.stateTtlMs ?? DEFAULT_STATE_TTL_MS)) {
          return failed(
            createError(
              "STATE_EXPIRED",
              "Pending WeChat auth state expired. Start sign-in again.",
              pending
            )
          );
        }
        const env = environment();
        const fallbackFlow = env.browser === "wechat" ? "wechat_browser_oauth" : "desktop_qr";
        const auth: WeChatAuthCodeResult = nativeResult
          ? {
              ...nativeResult,
              provider: pending?.provider || nativeResult.provider,
              flow: pending?.flow || nativeResult.flow,
              scope: pending?.scope || nativeResult.scope,
              redirectUri: pending?.redirectUri || nativeResult.redirectUri,
            }
          : {
              status: "success",
              code,
              state,
              provider:
                pending?.provider ||
                (fallbackFlow === "wechat_browser_oauth"
                  ? "wechat_official_account"
                  : "wechat_open_platform"),
              flow: pending?.flow || fallbackFlow,
              scope: pending?.scope || "profile",
              redirectUri: pending?.redirectUri || parsed!.redirectUri,
              environment: env,
              raw: { url },
            };
        const completed = await completePersisted(pending, auth);
        notify(completed);
        return completed;
      } catch (cause) {
        return failed(
          createError(
            "UNKNOWN",
            cause instanceof Error ? cause.message : "Unknown callback parsing error.",
            { cause }
          )
        );
      }
    },
    createAuthUrl: authUrl,
    detectEnvironment: environment,
    resolveFlow: resolved,
    isAvailable() {
      try {
        resolved();
        return true;
      } catch {
        return false;
      }
    },
    generateState: runtime.generateState,
    clearPendingAuth: () => runtime.storage.clear(),
    getPendingAuth: readPending,
    addAuthListener: addListener,
    clearAuthListeners: () => listeners.clear(),
  };
}
