import { browserFromUserAgent, deviceFromUserAgent } from "@chinafast/wechat-auth-core";
import type { WeChatAuthConfig, WeChatAuthEnvironment } from "./types.js";

type ExpoLike = {
  Constants?: {
    appOwnership?: "expo" | "guest" | "standalone" | null;
    executionEnvironment?: string;
  };
};

function getUserAgent(): string {
  if (typeof navigator === "undefined") {
    return "";
  }
  return navigator.userAgent || "";
}

function detectPlatform(ua: string): WeChatAuthEnvironment["platform"] {
  const rnPlatform = (globalThis as { Platform?: { OS?: string } }).Platform?.OS;
  if (rnPlatform === "ios" || rnPlatform === "android" || rnPlatform === "web") {
    return rnPlatform;
  }
  const value = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(value)) {
    return typeof window === "undefined" ? "ios" : "web";
  }
  if (/android/.test(value)) {
    return typeof window === "undefined" ? "android" : "web";
  }
  if (typeof window !== "undefined") {
    return "web";
  }
  return "unknown";
}

function detectRuntime(
  platform: WeChatAuthEnvironment["platform"]
): WeChatAuthEnvironment["runtime"] {
  if (platform === "web") {
    return "web";
  }
  const expo = (globalThis as { Expo?: ExpoLike }).Expo;
  const ownership = expo?.Constants?.appOwnership;
  if (ownership === "expo") {
    return "expo-go";
  }
  if (ownership === "standalone") {
    return "standalone";
  }
  if (ownership === "guest") {
    return "expo-dev-client";
  }
  return platform === "ios" || platform === "android" ? "standalone" : "unknown";
}

/** Detects the current Expo/React Native/web environment without requiring Expo at import time. */
export function detectEnvironment(config: WeChatAuthConfig = {}): WeChatAuthEnvironment {
  const ua = getUserAgent();
  const platform = detectPlatform(ua);
  const runtime = detectRuntime(platform);
  const browser = browserFromUserAgent(ua);
  const device = deviceFromUserAgent(ua, typeof window !== "undefined");
  const nativeRuntime = platform === "ios" || platform === "android";
  const supportsNativeWeChatSdk =
    nativeRuntime && runtime !== "expo-go" && Boolean(config.native?.appId);

  return {
    platform,
    device,
    browser,
    runtime,
    supports: {
      nativeWeChatSdk: supportsNativeWeChatSdk,
      deepLink: nativeRuntime || Boolean(config.scheme || config.native?.redirectUri),
      universalLink: Boolean(config.native?.universalLink),
      qrLogin: platform === "web" && device === "desktop" && Boolean(config.web?.appId),
      officialAccountOAuth: browser === "wechat" && Boolean(config.officialAccount?.appId),
      webRedirect:
        platform === "web" &&
        Boolean(config.web?.redirectUri || config.officialAccount?.redirectUri),
    },
  };
}
