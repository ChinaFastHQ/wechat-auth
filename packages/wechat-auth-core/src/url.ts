import { createError, WeChatAuthException } from "./errors.js";
import { mapScopeToWechat } from "./flow.js";
import type { ResolvedWeChatAuthFlow, WeChatAuthConfig, WeChatAuthorizeInput } from "./types.js";

export function createAuthorizationUrl(
  resolved: ResolvedWeChatAuthFlow,
  config: WeChatAuthConfig,
  input: WeChatAuthorizeInput = {}
): string | null {
  if (resolved.flow === "native_app") {
    return null;
  }
  const appId =
    resolved.flow === "wechat_browser_oauth" ? config.officialAccount?.appId : config.web?.appId;
  if (!appId) {
    throw new WeChatAuthException(
      createError("NOT_CONFIGURED", `appId is required for ${resolved.flow}.`, resolved)
    );
  }
  const base =
    resolved.flow === "desktop_qr"
      ? "https://open.weixin.qq.com/connect/qrconnect"
      : "https://open.weixin.qq.com/connect/oauth2/authorize";
  const values: Array<[string, string]> = [
    ["appid", appId],
    ["redirect_uri", resolved.redirectUri],
    ["response_type", "code"],
    ["scope", mapScopeToWechat(resolved.flow, resolved.scope)],
  ];
  if (input.state) {
    values.push(["state", input.state]);
  }
  const query = values
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  const url = `${base}?${query}`;
  return resolved.flow === "wechat_browser_oauth" ? `${url}#wechat_redirect` : url;
}
