import { randomBytes } from "node:crypto";
import type { WeChatAuthFlow } from "@chinafast/wechat-auth-core";

export type WeChatCredentials = { appId: string; secret: string };
export type WeChatServerCredentials = {
  openPlatform?: WeChatCredentials;
  web?: WeChatCredentials;
  officialAccount?: WeChatCredentials;
};
export type WeChatTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  openid: string;
  scope: string;
  unionid?: string;
};
export type WeChatUserInfo = {
  openid: string;
  unionid?: string;
  nickname?: string;
  headimgurl?: string;
};
export type WeChatCodeExchangeInput = { code: string; flow?: WeChatAuthFlow };
export type WeChatServerRequestOptions = { fetch?: typeof globalThis.fetch };
export type WeChatCodeExchangeOptions = WeChatServerRequestOptions & {
  credentials: WeChatServerCredentials;
};
type ApiError = { errcode?: number; errmsg?: string };

export function credentialsForFlow(
  credentials: WeChatServerCredentials,
  flow?: WeChatAuthFlow
): WeChatCredentials | undefined {
  if (flow === "wechat_browser_oauth") {
    return credentials.officialAccount;
  }
  if (flow === "desktop_qr") {
    return credentials.web;
  }
  return credentials.openPlatform;
}

export async function exchangeWeChatCode(
  input: WeChatCodeExchangeInput,
  options: WeChatCodeExchangeOptions
): Promise<WeChatTokenResponse> {
  if (!input.code) {
    throw new Error("A WeChat authorization code is required.");
  }
  const credentials = credentialsForFlow(options.credentials, input.flow);
  if (!credentials?.appId || !credentials.secret) {
    throw new Error(`Missing WeChat credentials for ${input.flow || "native_app"}.`);
  }
  const url = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
  url.searchParams.set("appid", credentials.appId);
  url.searchParams.set("secret", credentials.secret);
  url.searchParams.set("code", input.code);
  url.searchParams.set("grant_type", "authorization_code");
  const fetcher = options.fetch || globalThis.fetch;
  if (!fetcher) {
    throw new Error("A fetch implementation is required.");
  }
  const response = await fetcher(url);
  const payload = (await response.json()) as WeChatTokenResponse & ApiError;
  if (!response.ok || payload.errcode) {
    throw new Error(payload.errmsg || "WeChat token exchange failed.");
  }
  return payload;
}

export async function fetchWeChatUserInfo(
  token: WeChatTokenResponse,
  options: WeChatServerRequestOptions = {}
): Promise<WeChatUserInfo> {
  const scopes = token.scope.split(",").map((scope) => scope.trim());
  if (!scopes.some((scope) => scope === "snsapi_login" || scope === "snsapi_userinfo")) {
    return { openid: token.openid, unionid: token.unionid };
  }
  const url = new URL("https://api.weixin.qq.com/sns/userinfo");
  url.searchParams.set("access_token", token.access_token);
  url.searchParams.set("openid", token.openid);
  url.searchParams.set("lang", "zh_CN");
  const fetcher = options.fetch || globalThis.fetch;
  if (!fetcher) {
    throw new Error("A fetch implementation is required.");
  }
  const response = await fetcher(url);
  const payload = (await response.json()) as WeChatUserInfo & ApiError;
  if (!response.ok || payload.errcode) {
    throw new Error(payload.errmsg || "WeChat userinfo request failed.");
  }
  return payload;
}
export type WeChatStateResult = { ok: true } | { ok: false; reason: "not_found" | "expired" };
export type WeChatStateStore = {
  create(): { state: string; expiresAt: number } | Promise<{ state: string; expiresAt: number }>;
  consume(state: string): WeChatStateResult | Promise<WeChatStateResult>;
};
export type MemoryStateStore = {
  create(): { state: string; expiresAt: number };
  consume(state: string): WeChatStateResult;
};

export function createMemoryStateStore(
  options: { ttlMs?: number; clock?: () => number; generateState?: () => string } = {}
): MemoryStateStore {
  const ttlMs = options.ttlMs ?? 10 * 60 * 1000;
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error("ttlMs must be greater than zero.");
  }
  const clock = options.clock || Date.now;
  const generate = options.generateState || (() => randomBytes(16).toString("hex"));
  const states = new Map<string, number>();
  return {
    create() {
      const state = generate();
      const expiresAt = clock() + ttlMs;
      states.set(state, expiresAt);
      return { state, expiresAt };
    },
    consume(state) {
      const expiresAt = states.get(state);
      if (expiresAt === undefined) {
        return { ok: false, reason: "not_found" };
      }
      states.delete(state);
      return clock() > expiresAt ? { ok: false, reason: "expired" } : { ok: true };
    },
  };
}
