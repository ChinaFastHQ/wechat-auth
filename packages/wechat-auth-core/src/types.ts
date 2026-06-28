export type WeChatAuthScope = "base" | "profile";
export type WeChatAuthProvider = "wechat_open_platform" | "wechat_official_account";
export type WeChatAuthFlow = "native_app" | "desktop_qr" | "wechat_browser_oauth";

export type WeChatAuthEnvironment = {
  platform: "ios" | "android" | "web" | "unknown";
  device: "mobile" | "desktop" | "tablet" | "unknown";
  browser: "wechat" | "alipay" | "safari" | "chrome" | "edge" | "firefox" | "webview" | "unknown";
  runtime: "expo-dev-client" | "expo-go" | "standalone" | "web" | "unknown";
  supports: {
    nativeWeChatSdk: boolean;
    deepLink: boolean;
    universalLink: boolean;
    qrLogin: boolean;
    officialAccountOAuth: boolean;
    webRedirect: boolean;
  };
};

/** Client-safe configuration. Server secrets are deliberately not part of this type. */
export type WeChatAuthConfig = {
  native?: { appId: string; redirectUri: string; universalLink?: string };
  web?: { appId: string; redirectUri: string };
  officialAccount?: { appId: string; redirectUri: string };
  scheme?: string;
  stateStorageKey?: string;
  stateTtlMs?: number;
  requireStoredState?: boolean;
  exchangeUrl?: string;
  stateUrl?: string;
  debug?: boolean;
};

export type WeChatAuthorizeInput = {
  scope?: WeChatAuthScope;
  state?: string;
  redirectUri?: string;
  returnTo?: string;
  metadata?: Record<string, string | number | boolean>;
  advanced?: {
    forceFlow?: WeChatAuthFlow;
    forceProvider?: WeChatAuthProvider;
    prompt?: "login" | "none";
  };
};
export type WeChatSessionExchangeInput = {
  code: string;
  state: string;
  flow: WeChatAuthFlow;
  redirectUri: string;
};
export type WeChatSignInInput = WeChatAuthorizeInput & {
  exchangeUrl?: string;
  stateUrl?: string;
  exchange?: (input: WeChatSessionExchangeInput) => Promise<unknown>;
};
export type WeChatAuthSuccess = {
  status: "success";
  code: string;
  state: string;
  provider: WeChatAuthProvider;
  flow: WeChatAuthFlow;
  scope: WeChatAuthScope;
  redirectUri: string;
  environment: WeChatAuthEnvironment;
  raw?: unknown;
  session?: unknown;
};
export type WeChatAuthCodeResult = WeChatAuthSuccess;
export type WeChatAuthPendingResult = {
  status: "pending";
  provider: WeChatAuthProvider;
  flow: WeChatAuthFlow;
  scope: WeChatAuthScope;
  state: string;
  redirectUri: string;
  authUrl?: string;
};
export type WeChatAuthCancelledResult = {
  status: "cancelled";
  provider?: WeChatAuthProvider;
  flow?: WeChatAuthFlow;
  state?: string;
};
export type WeChatAuthErrorCode =
  | "NOT_CONFIGURED"
  | "UNSUPPORTED_ENVIRONMENT"
  | "WECHAT_NOT_INSTALLED"
  | "AUTH_CANCELLED"
  | "AUTH_FAILED"
  | "INVALID_STATE"
  | "MISSING_STATE"
  | "STATE_EXPIRED"
  | "MISSING_CODE"
  | "POPUP_BLOCKED"
  | "REDIRECT_FAILED"
  | "EXCHANGE_FAILED"
  | "NATIVE_SDK_MISSING"
  | "NETWORK_ERROR"
  | "UNKNOWN";
export type WeChatAuthError = {
  code: WeChatAuthErrorCode;
  message: string;
  provider?: WeChatAuthProvider;
  flow?: WeChatAuthFlow;
  cause?: unknown;
};
export type WeChatAuthFailedResult = { status: "failed"; error: WeChatAuthError };
export type WeChatAuthorizeResult =
  | WeChatAuthSuccess
  | WeChatAuthPendingResult
  | WeChatAuthCancelledResult
  | WeChatAuthFailedResult;
export type WeChatSignInResult<TSession = unknown> =
  | { status: "success"; auth: WeChatAuthSuccess; session: TSession }
  | { status: "cancelled" }
  | { status: "error"; error: { code: string; message: string } };
export type WeChatPendingAuth = {
  provider: WeChatAuthProvider;
  flow: WeChatAuthFlow;
  scope: WeChatAuthScope;
  state: string;
  redirectUri: string;
  authUrl?: string;
  createdAt: number;
  returnTo?: string;
  metadata?: Record<string, string | number | boolean>;
  exchangeUrl?: string;
};
export type WeChatAuthListener = (result: WeChatAuthorizeResult) => void;
export type ResolvedWeChatAuthFlow = {
  provider: WeChatAuthProvider;
  flow: WeChatAuthFlow;
  scope: WeChatAuthScope;
  redirectUri: string;
  environment: WeChatAuthEnvironment;
};
