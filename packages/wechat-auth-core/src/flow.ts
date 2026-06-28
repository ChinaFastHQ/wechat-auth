import { createError, WeChatAuthException } from "./errors.js";
import type {
  ResolvedWeChatAuthFlow,
  WeChatAuthConfig,
  WeChatAuthEnvironment,
  WeChatAuthFlow,
  WeChatAuthProvider,
  WeChatAuthorizeInput,
} from "./types.js";

export function normalizeScope(scope: WeChatAuthorizeInput["scope"]): "base" | "profile" {
  return scope || "profile";
}

export function mapScopeToWechat(flow: WeChatAuthFlow, scope: "base" | "profile"): string {
  if (flow === "desktop_qr") {
    return "snsapi_login";
  }
  if (flow === "wechat_browser_oauth") {
    return scope === "base" ? "snsapi_base" : "snsapi_userinfo";
  }
  return "snsapi_userinfo";
}

function providerForFlow(flow: WeChatAuthFlow, forced?: WeChatAuthProvider): WeChatAuthProvider {
  return (
    forced || (flow === "wechat_browser_oauth" ? "wechat_official_account" : "wechat_open_platform")
  );
}

function validateFlow(flow: WeChatAuthFlow, config: WeChatAuthConfig): void {
  if (flow === "native_app" && !config.native?.appId) {
    throw new WeChatAuthException(
      createError("NOT_CONFIGURED", "Native WeChat appId is required.")
    );
  }
  if (flow === "desktop_qr" && !config.web?.appId) {
    throw new WeChatAuthException(createError("NOT_CONFIGURED", "Web WeChat appId is required."));
  }
  if (flow === "wechat_browser_oauth" && !config.officialAccount?.appId) {
    throw new WeChatAuthException(
      createError("NOT_CONFIGURED", "Official Account appId is required.")
    );
  }
}

export function resolveFlow(
  input: WeChatAuthorizeInput = {},
  config: WeChatAuthConfig,
  environment: WeChatAuthEnvironment
): ResolvedWeChatAuthFlow {
  let flow = input.advanced?.forceFlow;
  if (flow) {
    validateFlow(flow, config);
  }
  if (!flow) {
    if (
      (environment.platform === "ios" || environment.platform === "android") &&
      environment.supports.nativeWeChatSdk
    ) {
      flow = "native_app";
    } else if (environment.browser === "wechat" && environment.supports.officialAccountOAuth) {
      flow = "wechat_browser_oauth";
    } else if (
      environment.platform === "web" &&
      environment.device === "desktop" &&
      environment.supports.qrLogin
    ) {
      flow = "desktop_qr";
    }
  }
  if (!flow) {
    throw new WeChatAuthException(
      createError("UNSUPPORTED_ENVIRONMENT", "WeChat auth is not supported in this environment.")
    );
  }
  const redirectUri =
    input.redirectUri ||
    (flow === "wechat_browser_oauth"
      ? config.officialAccount?.redirectUri
      : flow === "desktop_qr"
        ? config.web?.redirectUri
        : config.native?.redirectUri);
  if (!redirectUri) {
    throw new WeChatAuthException(
      createError("NOT_CONFIGURED", `redirectUri is required for ${flow}.`, { flow })
    );
  }
  if (flow === "native_app" && normalizeScope(input.scope) === "base") {
    throw new WeChatAuthException(
      createError(
        "UNSUPPORTED_ENVIRONMENT",
        "Native WeChat login only supports profile authorization (snsapi_userinfo).",
        { flow }
      )
    );
  }
  return {
    provider: providerForFlow(flow, input.advanced?.forceProvider),
    flow,
    scope: normalizeScope(input.scope),
    redirectUri,
    environment,
  };
}
